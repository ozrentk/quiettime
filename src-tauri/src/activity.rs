use crate::{
    platform,
    state::{lock, Core, State},
    tray,
    utils::now,
};
use std::time::Instant;
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
    app.state::<crate::timing::Schedule>().0.notify_all();
    tray::sync(app, paused);
    let _ = app.emit("tracking-changed", ());
    Ok(())
}

pub(crate) fn spawn(app: tauri::AppHandle) {
    std::thread::spawn(move || loop {
        if !crate::timing::wait(&app, crate::timing::Interval::Activity, Instant::now()) {
            return;
        }
        let state = app.state::<State>();
        let Ok(mut core) = lock(&state) else { continue };
        if core.paused {
            core.previous = None;
            continue;
        }
        let timestamp = now();
        let previous_error = core.capture_error.clone();
        match platform::sample(core.capture_titles, core.timings.idle_seconds) {
            Ok(current) => {
                if let Some((start, previous)) = core.previous.take() {
                    if let Err(error) = core.store.record_with_gap(
                        start,
                        timestamp,
                        &previous,
                        core.timings.max_gap_ms(),
                    ) {
                        core.capture_error = Some(format!("Activity could not be saved: {error}"));
                        if previous_error != core.capture_error {
                            let _ = app.emit("capture-health-changed", ());
                        }
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
        if previous_error != core.capture_error {
            let _ = app.emit("capture-health-changed", ());
        }
    });
}
