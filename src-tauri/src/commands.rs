use crate::{
    activity, hud, startup,
    state::{lock, State},
    store::{Activity, Entry},
    utils::now,
};
use serde::Serialize;
use tauri_plugin_global_shortcut::GlobalShortcutExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Dashboard {
    startup_enabled: bool,
    startup_available: bool,
    paused: bool,
    capture_titles: bool,
    timings: crate::timing::TimingSettings,
    shortcut: String,
    shortcut_error: Option<String>,
    capture_error: Option<String>,
    database_path: String,
    entries: Vec<Entry>,
    projects: Vec<String>,
    activity: Vec<Activity>,
}

#[tauri::command]
pub(crate) fn dashboard(
    state: tauri::State<State>,
    from: i64,
    to: i64,
) -> Result<Dashboard, String> {
    if to <= from || to - from > 32 * 86_400_000 {
        return Err("Choose a range of up to 31 days".into());
    }
    let core = lock(&state)?;
    Ok(Dashboard {
        startup_enabled: startup::enabled()?,
        startup_available: startup::available(),
        paused: core.paused,
        capture_titles: core.capture_titles,
        timings: core.timings,
        shortcut: core.shortcut.clone(),
        shortcut_error: core.shortcut_error.clone(),
        capture_error: core.capture_error.clone(),
        database_path: core.database_path.clone(),
        entries: core.store.entries(from, to)?,
        projects: core.store.projects()?,
        activity: core.store.activity(from, to)?,
    })
}

#[tauri::command]
pub(crate) fn save_project(state: tauri::State<State>, name: String) -> Result<String, String> {
    lock(&state)?.store.save_project(&name)
}

#[tauri::command]
pub(crate) fn add_entry(
    state: tauri::State<State>,
    project: String,
    note: String,
    end: i64,
    minutes: i64,
) -> Result<i64, String> {
    if !(1..=480).contains(&minutes) || end > now() + 60_000 || end < 0 {
        return Err("Choose a past end time and a duration from 1 to 480 whole minutes".into());
    }
    lock(&state)?
        .store
        .add_entry(&project, &note, end - minutes * 60_000, end)
}

#[tauri::command]
pub(crate) fn add_manual_entry(
    state: tauri::State<State>,
    project: String,
    note: String,
    start: i64,
    end: i64,
) -> Result<i64, String> {
    if start < 0 || end > now() + 60_000 {
        return Err("Manual entries must end in the past".into());
    }
    lock(&state)?.store.add_entry(&project, &note, start, end)
}

#[tauri::command]
pub(crate) fn delete_entry(state: tauri::State<State>, id: i64) -> Result<(), String> {
    lock(&state)?.store.delete_entry(id)
}

#[tauri::command]
pub(crate) fn set_paused(
    app: tauri::AppHandle,
    state: tauri::State<State>,
    paused: bool,
) -> Result<(), String> {
    activity::set_paused(&app, &state, paused)
}

#[tauri::command]
pub(crate) fn set_startup(enabled: bool) -> Result<(), String> {
    startup::set_enabled(enabled)
}

#[tauri::command]
pub(crate) fn set_capture_titles(state: tauri::State<State>, enabled: bool) -> Result<(), String> {
    let mut core = lock(&state)?;
    core.store
        .set_setting("capture_titles", if enabled { "true" } else { "false" })?;
    core.capture_titles = enabled;
    core.previous = None;
    Ok(())
}

#[tauri::command]
pub(crate) fn set_shortcut(
    app: tauri::AppHandle,
    state: tauri::State<State>,
    shortcut: String,
) -> Result<(), String> {
    if shortcut.len() > 80 || !shortcut.contains('+') {
        return Err("Use a modifier combination, for example Ctrl+Alt+T".into());
    }
    let mut core = lock(&state)?;
    if shortcut == core.shortcut && core.shortcut_error.is_none() {
        return Ok(());
    }
    app.global_shortcut()
        .register(shortcut.as_str())
        .map_err(|e| format!("Cannot register shortcut: {e}"))?;
    if let Err(error) = core.store.set_setting("shortcut", &shortcut) {
        let _ = app.global_shortcut().unregister(shortcut.as_str());
        return Err(error);
    }
    let _ = app.global_shortcut().unregister(core.shortcut.as_str());
    core.shortcut = shortcut;
    core.shortcut_error = None;
    Ok(())
}

#[tauri::command]
pub(crate) fn hide_hud(app: tauri::AppHandle) -> Result<(), String> {
    hud::hide(&app)
}
