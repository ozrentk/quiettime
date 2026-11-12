use crate::{platform, store::Store};
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

const DEFAULT_SHORTCUT: &str = "Ctrl+Alt+T";
pub(crate) struct Core {
    pub(crate) store: Store,
    pub(crate) paused: bool,
    pub(crate) capture_titles: bool,
    pub(crate) shortcut: String,
    pub(crate) shortcut_error: Option<String>,
    pub(crate) capture_error: Option<String>,
    pub(crate) previous: Option<(i64, platform::Sample)>,
    pub(crate) database_path: String,
}
pub(crate) type State = Mutex<Core>;

pub(crate) fn lock(state: &State) -> Result<std::sync::MutexGuard<'_, Core>, String> {
    state
        .lock()
        .map_err(|_| "Local storage is unavailable; restart the app".into())
}

pub(crate) fn initialize(app: &tauri::AppHandle) -> Result<bool, Box<dyn std::error::Error>> {
    let directory = app.path().app_local_data_dir()?;
    std::fs::create_dir_all(&directory)?;
    let path = directory.join("quiet-time.sqlite3");
    let store = Store::new(rusqlite::Connection::open(&path)?).map_err(std::io::Error::other)?;
    let paused = store
        .setting("paused", "true")
        .map_err(std::io::Error::other)?
        == "true";
    let capture_titles = store
        .setting("capture_titles", "true")
        .map_err(std::io::Error::other)?
        == "true";
    let shortcut = store
        .setting("shortcut", DEFAULT_SHORTCUT)
        .map_err(std::io::Error::other)?;
    let shortcut_error = app
        .global_shortcut()
        .register(shortcut.as_str())
        .err()
        .map(|e| e.to_string());
    app.manage(Mutex::new(Core {
        store,
        paused,
        capture_titles,
        shortcut,
        shortcut_error,
        capture_error: None,
        previous: None,
        database_path: path.to_string_lossy().into_owned(),
    }));
    Ok(paused)
}
