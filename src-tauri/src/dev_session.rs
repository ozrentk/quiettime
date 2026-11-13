//! Windows signals the launcher process handle when its development session ends.
use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle};
use windows::Win32::{
    Foundation::{FILETIME, HANDLE, WAIT_OBJECT_0},
    System::Threading::{
        GetProcessTimes, OpenProcess, WaitForSingleObject, INFINITE,
        PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_SYNCHRONIZE,
    },
};

fn creation_time(handle: &OwnedHandle) -> Result<u64, String> {
    let mut created = FILETIME::default();
    let mut exited = FILETIME::default();
    let mut kernel = FILETIME::default();
    let mut user = FILETIME::default();
    unsafe {
        GetProcessTimes(
            HANDLE(handle.as_raw_handle()),
            &mut created,
            &mut exited,
            &mut kernel,
            &mut user,
        )
        .map_err(|error| error.to_string())?;
    }
    Ok((u64::from(created.dwHighDateTime) << 32) | u64::from(created.dwLowDateTime))
}

fn open_launcher(pid: u32, expected_start: u64) -> Result<OwnedHandle, String> {
    let raw = unsafe {
        OpenProcess(
            PROCESS_SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION,
            false,
            pid,
        )
    }
    .map_err(|error| format!("Development launcher is no longer available: {error}"))?;
    // OpenProcess transfers ownership; the handle stays bound to this process even if its PID is reused.
    let handle = unsafe { OwnedHandle::from_raw_handle(raw.0) };
    if creation_time(&handle)? != expected_start {
        return Err("Development launcher identity changed".into());
    }
    Ok(handle)
}

pub(crate) fn spawn(app: tauri::AppHandle) -> Result<(), String> {
    let Ok(pid) = std::env::var("QUIET_TIME_DEV_LAUNCHER_PID") else {
        return Ok(());
    };
    let pid = pid
        .parse()
        .map_err(|_| "Invalid development launcher PID")?;
    let started = std::env::var("QUIET_TIME_DEV_LAUNCHER_STARTED")
        .map_err(|_| "Missing development launcher start time")?
        .parse()
        .map_err(|_| "Invalid development launcher start time")?;
    // Acquire and validate the handle before starting the wait thread.
    let launcher = open_launcher(pid, started)?;
    std::thread::Builder::new()
        .name("development-launcher".into())
        .spawn(move || {
            let result = unsafe { WaitForSingleObject(HANDLE(launcher.as_raw_handle()), INFINITE) };
            if result != WAIT_OBJECT_0 {
                eprintln!(
                    "Waiting for development launcher failed: {:?}",
                    std::io::Error::last_os_error()
                );
            }
            // Normal Tauri shutdown removes the tray icon and exits the app.
            app.exit(0);
        })
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::process::{Command, Stdio};
    use windows::Win32::Foundation::WAIT_TIMEOUT;

    #[test]
    fn process_handle_signals_on_exit_and_rejects_wrong_identity() {
        let mut child = Command::new("cmd.exe")
            .args(["/c", "pause"])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .spawn()
            .unwrap();
        // Child owns a real process handle and remains blocked waiting for input.
        let raw = unsafe {
            OpenProcess(
                PROCESS_SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION,
                false,
                child.id(),
            )
        }
        .unwrap();
        let owned = unsafe { OwnedHandle::from_raw_handle(raw.0) };
        let started = creation_time(&owned).unwrap();
        assert!(open_launcher(child.id(), started.wrapping_add(1)).is_err());
        let launcher = open_launcher(child.id(), started).unwrap();
        assert_eq!(
            unsafe { WaitForSingleObject(HANDLE(launcher.as_raw_handle()), 0) },
            WAIT_TIMEOUT
        );
        child.kill().unwrap();
        child.wait().unwrap();
        assert_eq!(
            unsafe { WaitForSingleObject(HANDLE(launcher.as_raw_handle()), 5000) },
            WAIT_OBJECT_0
        );
    }
}
