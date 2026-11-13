#[cfg(windows)]
pub(crate) fn pick(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri::Manager;
    use windows::{
        core::w,
        Win32::{
            Foundation::HWND,
            System::Com::{
                CoCreateInstance, CoInitializeEx, CoTaskMemFree, CoUninitialize,
                CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
            },
            UI::Shell::{
                FileOpenDialog, IFileOpenDialog, FOS_FORCEFILESYSTEM, FOS_PATHMUSTEXIST,
                FOS_PICKFOLDERS, SIGDN_FILESYSPATH,
            },
        },
    };
    struct ComGuard;
    impl Drop for ComGuard {
        fn drop(&mut self) {
            unsafe {
                CoUninitialize();
            }
        }
    }
    let parent = app
        .get_webview_window("main")
        .and_then(|window| window.hwnd().ok())
        .map(|handle| HWND(handle.0));
    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED)
            .ok()
            .map_err(|e| e.to_string())?;
        let _com = ComGuard;
        let dialog: IFileOpenDialog = CoCreateInstance(&FileOpenDialog, None, CLSCTX_INPROC_SERVER)
            .map_err(|e| e.to_string())?;
        dialog
            .SetOptions(FOS_PICKFOLDERS | FOS_FORCEFILESYSTEM | FOS_PATHMUSTEXIST)
            .map_err(|e| e.to_string())?;
        dialog
            .SetTitle(w!("Choose a local Git repository"))
            .map_err(|e| e.to_string())?;
        if let Err(error) = dialog.Show(parent) {
            if error.code().0 as u32 == 0x800704C7 {
                return Ok(None);
            }
            return Err(error.to_string());
        }
        let item = dialog.GetResult().map_err(|e| e.to_string())?;
        let name = item
            .GetDisplayName(SIGDN_FILESYSPATH)
            .map_err(|e| e.to_string())?;
        let value = name.to_string().map_err(|e| e.to_string());
        CoTaskMemFree(Some(name.0.cast()));
        value.map(Some)
    }
}

#[cfg(not(windows))]
pub(crate) fn pick(_: &tauri::AppHandle) -> Result<Option<String>, String> {
    Err("Enter the repository path manually on this platform".into())
}
