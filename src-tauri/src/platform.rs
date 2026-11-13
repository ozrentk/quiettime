#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Sample {
    pub app: String,
    pub title: String,
    pub kind: String,
}

#[cfg(windows)]
pub fn sample(capture_titles: bool, idle_seconds: u64) -> Result<Sample, String> {
    use windows::{
        core::PWSTR,
        Win32::{
            Foundation::CloseHandle,
            System::{
                SystemInformation::GetTickCount,
                Threading::{
                    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
                    PROCESS_QUERY_LIMITED_INFORMATION,
                },
            },
            UI::{
                Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO},
                WindowsAndMessaging::{
                    GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
                },
            },
        },
    };
    // Read only foreground metadata and the last-input timestamp. No input hooks.
    unsafe {
        let mut input = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };
        if !GetLastInputInfo(&mut input).as_bool() {
            return Err("Windows idle detection is unavailable".into());
        }
        if u64::from(GetTickCount().wrapping_sub(input.dwTime)) >= idle_seconds * 1000 {
            return Ok(Sample {
                app: "Idle".into(),
                title: String::new(),
                kind: "idle".into(),
            });
        }
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return Err("No accessible foreground window (possibly locked)".into());
        }
        let mut pid = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == std::process::id() {
            return Ok(Sample {
                app: "Quiet Time".into(),
                title: String::new(),
                kind: "hud".into(),
            });
        }
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
            .map_err(|e| e.to_string())?;
        let mut path = vec![0u16; 32768];
        let mut length = path.len() as u32;
        let result = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_WIN32,
            PWSTR(path.as_mut_ptr()),
            &mut length,
        );
        let _ = CloseHandle(handle);
        result.map_err(|e| e.to_string())?;
        let path = String::from_utf16_lossy(&path[..length as usize]);
        let app = path.rsplit('\\').next().unwrap_or("Unknown").to_string();
        let title = if capture_titles {
            let mut text = [0u16; 1024];
            let len = GetWindowTextW(hwnd, &mut text);
            String::from_utf16_lossy(&text[..len.max(0) as usize])
        } else {
            String::new()
        };
        Ok(Sample {
            app,
            title,
            kind: "active".into(),
        })
    }
}

#[cfg(not(windows))]
pub fn sample(_: bool, _: u64) -> Result<Sample, String> {
    Err("Activity capture currently requires Windows".into())
}
