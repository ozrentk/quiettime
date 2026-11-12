const BACKGROUND_ARG: &str = "--background";

pub fn is_background(args: impl IntoIterator<Item = String>) -> bool {
    args.into_iter().skip(1).any(|arg| arg == BACKGROUND_ARG)
}

pub fn available() -> bool {
    cfg!(all(windows, feature = "custom-protocol"))
}

fn startup_command(executable: &std::path::Path) -> Result<String, String> {
    let path = executable
        .to_str()
        .ok_or("The application path must be valid Unicode")?;
    if path.contains('"') {
        return Err("The application path contains an invalid quote".into());
    }
    Ok(format!("\"{path}\" {BACKGROUND_ARG}"))
}

#[cfg(windows)]
mod windows_startup {
    use super::startup_command;
    use winreg::{
        enums::{HKEY_CURRENT_USER, KEY_QUERY_VALUE, KEY_SET_VALUE},
        RegKey,
    };
    const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    const VALUE: &str = "QuietTime";

    pub fn enabled() -> Result<bool, String> {
        let current_user = RegKey::predef(HKEY_CURRENT_USER);
        let key = match current_user.open_subkey_with_flags(RUN_KEY, KEY_QUERY_VALUE) {
            Ok(key) => key,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(false),
            Err(e) => return Err(e.to_string()),
        };
        match key.get_value::<String, _>(VALUE) {
            Ok(value) => {
                Ok(value == startup_command(&std::env::current_exe().map_err(|e| e.to_string())?)?)
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
            Err(e) => Err(e.to_string()),
        }
    }

    pub fn set_enabled(enabled: bool) -> Result<(), String> {
        let current_user = RegKey::predef(HKEY_CURRENT_USER);
        if enabled {
            let command = startup_command(&std::env::current_exe().map_err(|e| e.to_string())?)?;
            let (key, _) = current_user
                .create_subkey(RUN_KEY)
                .map_err(|e| e.to_string())?;
            key.set_value(VALUE, &command).map_err(|e| e.to_string())
        } else {
            let key = match current_user.open_subkey_with_flags(RUN_KEY, KEY_SET_VALUE) {
                Ok(key) => key,
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
                Err(e) => return Err(e.to_string()),
            };
            match key.delete_value(VALUE) {
                Ok(()) => Ok(()),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
                Err(e) => Err(e.to_string()),
            }
        }
    }
}

pub fn enabled() -> Result<bool, String> {
    if !available() {
        return Ok(false);
    }
    #[cfg(windows)]
    return windows_startup::enabled();
    #[cfg(not(windows))]
    Ok(false)
}

pub fn set_enabled(enabled: bool) -> Result<(), String> {
    if !available() {
        return Err("Use the standalone app (npm run desktop) to configure Windows startup".into());
    }
    #[cfg(windows)]
    return windows_startup::set_enabled(enabled);
    #[cfg(not(windows))]
    Err("Windows startup is only available on Windows".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn quotes_the_executable_and_requests_a_hidden_launch() {
        assert_eq!(
            startup_command(std::path::Path::new(r"C:\My App\quiet-time.exe")).unwrap(),
            r#""C:\My App\quiet-time.exe" --background"#
        );
    }
    #[test]
    fn only_the_background_argument_suppresses_the_hud() {
        let args = |values: &[&str]| values.iter().map(|v| v.to_string()).collect::<Vec<_>>();
        assert!(is_background(args(&["app.exe", "--background"])));
        assert!(!is_background(args(&["app.exe"])));
        assert!(!is_background(args(&["app.exe", "--background-other"])));
    }
}
