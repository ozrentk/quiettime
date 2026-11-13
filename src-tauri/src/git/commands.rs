use super::{
    folder_picker,
    models::{Inspection, RepositoryInput, Snapshot, SyncResult},
    reader, service,
};
use crate::state::{lock, State};
use tauri::Manager;

#[tauri::command]
pub(crate) fn git_snapshot(
    app: tauri::AppHandle,
    state: tauri::State<State>,
    repository_id: Option<i64>,
    from: Option<i64>,
    to: Option<i64>,
    limit: u32,
) -> Result<Snapshot, String> {
    if !(1..=1000).contains(&limit) || from.zip(to).is_some_and(|(from, to)| from >= to) {
        return Err("Invalid Git timeline filter".into());
    }
    let core = lock(&state)?;
    let (commits, has_more) = core.store.git_timeline(repository_id, from, to, limit)?;
    Ok(Snapshot {
        repositories: core.store.git_repositories()?,
        commits,
        has_more,
        busy: app.state::<service::ImportState>().is_busy(),
    })
}

#[tauri::command]
pub(crate) async fn git_inspect(path: String) -> Result<Inspection, String> {
    tauri::async_runtime::spawn_blocking(move || reader::inspect(&path))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub(crate) async fn git_save_repository(
    app: tauri::AppHandle,
    mut input: RepositoryInput,
) -> Result<i64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let inspection = reader::inspect(&input.path)?;
        if !input.all_authors && input.authors.iter().all(|email| email.trim().is_empty()) {
            input.authors = inspection.authors.clone();
        }
        service::validate(&mut input)?;
        lock(&app.state::<State>())?
            .store
            .git_save_repository(&input, &inspection)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub(crate) fn git_remove_repository(state: tauri::State<State>, id: i64) -> Result<(), String> {
    lock(&state)?.store.git_delete_repository(id)
}

#[tauri::command]
pub(crate) async fn git_refresh(
    app: tauri::AppHandle,
    repository_id: Option<i64>,
) -> Result<SyncResult, String> {
    tauri::async_runtime::spawn_blocking(move || service::sync(&app, repository_id, false))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub(crate) async fn git_pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || folder_picker::pick(&app))
        .await
        .map_err(|e| e.to_string())?
}
