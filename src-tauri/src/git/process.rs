use std::{
    io::Read,
    path::Path,
    process::{Command, ExitStatus, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::{Duration, Instant},
};

pub(crate) struct Output {
    pub status: ExitStatus,
    pub stdout: Vec<u8>,
    pub stderr: String,
}

fn read_limited(
    mut stream: impl Read,
    limit: usize,
    exceeded: Arc<AtomicBool>,
) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    stream
        .by_ref()
        .take((limit + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() > limit {
        exceeded.store(true, Ordering::Release);
    }
    Ok(bytes)
}

// Invoke Git directly with bounded output and runtime. Never invoke a shell, pager,
// credential prompt, fetch, pull, or any operation that changes the repository.
pub(crate) fn run(path: &Path, args: &[&str]) -> Result<Output, String> {
    let mut command = Command::new("git");
    command
        .args([
            "--no-pager",
            "-c",
            "core.fsmonitor=false",
            "-c",
            "gc.auto=0",
            "-c",
            "protocol.allow=never",
            "-C",
        ])
        .arg(path)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_NO_LAZY_FETCH", "1")
        .env("GIT_OPTIONAL_LOCKS", "0");
    for key in [
        "GIT_DIR",
        "GIT_WORK_TREE",
        "GIT_COMMON_DIR",
        "GIT_INDEX_FILE",
        "GIT_NAMESPACE",
    ] {
        command.env_remove(key);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    let mut child = command.spawn().map_err(|e| {
        format!("Could not start Git. Install Git for Windows and restart Quiet Time. {e}")
    })?;
    let exceeded = Arc::new(AtomicBool::new(false));
    let stdout = child
        .stdout
        .take()
        .ok_or("Git output pipe is unavailable")?;
    let stderr = child.stderr.take().ok_or("Git error pipe is unavailable")?;
    let output_limit = exceeded.clone();
    let error_limit = exceeded.clone();
    let out = thread::spawn(move || read_limited(stdout, 32 * 1024 * 1024, output_limit));
    let err = thread::spawn(move || read_limited(stderr, 64 * 1024, error_limit));
    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None)
                if started.elapsed() < Duration::from_secs(30)
                    && !exceeded.load(Ordering::Acquire) =>
            {
                thread::sleep(Duration::from_millis(25))
            }
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                break Err("Git import exceeded its time or output limit. Choose a more recent import date.".to_string());
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                break Err(error.to_string());
            }
        }
    };
    let stdout = out.join().map_err(|_| "Git output reader failed")??;
    let stderr = err.join().map_err(|_| "Git error reader failed")??;
    if exceeded.load(Ordering::Acquire) {
        return Err("Git output is too large. Choose a more recent import date.".into());
    }
    Ok(Output {
        status: status?,
        stdout,
        stderr: String::from_utf8_lossy(&stderr).trim().to_string(),
    })
}

pub(crate) fn checked(path: &Path, args: &[&str]) -> Result<Vec<u8>, String> {
    let output = run(path, args)?;
    if !output.status.success() {
        return Err(if output.stderr.is_empty() {
            "Git could not read this repository".into()
        } else {
            output.stderr
        });
    }
    Ok(output.stdout)
}
