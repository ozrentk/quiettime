use crate::{
    platform,
    state::{lock, Core, State},
    tray,
    utils::now,
};
use std::time::Duration;
use tauri::{Emitter, Manager};

fn pause(core: &mut Core, paused: bool) -> Result<(), String> {
    core.store
        .set_setting("paused", if paused { "true" } else { "false" })?;
    core.paused = paused;
    core.previous = None;
    core.capture_error = None;
    Ok(())
}

pub(crate) fn set_paused(
    app: &tauri::AppHandle,
    state: &State,
    paused: bool,
) -> Result<(), String> {
    {
        let mut core = lock(state)?;
        pause(&mut core, paused)?;
    }
    tray::sync(app, paused);
    let _ = app.emit("tracking-changed", ());
    Ok(())
}

pub(crate) fn spawn(app: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(5));
        let state = app.state::<State>();
        let Ok(mut core) = lock(&state) else { continue };
        if core.paused {
            core.previous = None;
            continue;
        }
        let timestamp = now();
        match platform::sample(core.capture_titles) {
            Ok(current) => {
                if let Some((start, previous)) = core.previous.take() {
                    if let Err(error) = core.store.record(start, timestamp, &previous) {
                        core.capture_error = Some(format!("Activity could not be saved: {error}"));
                        continue;
                    }
                }
                core.previous = Some((timestamp, current));
                core.capture_error = None;
            }
            Err(error) => {
                core.previous = None;
                core.capture_error = Some(error);
            }
        }
    });
}
