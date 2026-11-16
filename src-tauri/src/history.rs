use crate::{
    git::TimelineCommit,
    state::{lock, State},
    store::{Activity, Entry},
};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TimelineSnapshot {
    entries: Vec<Entry>,
    activity: Vec<Activity>,
    commits: Vec<TimelineCommit>,
}

#[tauri::command]
pub(crate) async fn timeline_snapshot(
    app: tauri::AppHandle,
    from: i64,
    to: i64,
) -> Result<TimelineSnapshot, String> {
    // A local calendar week can be 167 or 169 hours across DST changes.
    if from < 0 || to <= from || to - from > 8 * 86_400_000 {
        return Err("Choose a timeline range of up to one week".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        use tauri::Manager;
        let state = app.state::<State>();
        let core = lock(&state)?;
        Ok(TimelineSnapshot {
            entries: core.store.entries(from, to)?,
            activity: core.store.activity(from, to)?,
            commits: core.store.git_history(from, to)?,
        })
    })
    .await
    .map_err(|error| error.to_string())?
}
