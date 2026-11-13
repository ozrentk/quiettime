use crate::utils::centered_position;
use std::{sync::Mutex, time::Instant};
use tauri::{Emitter, Manager};

#[derive(Default)]
struct Visibility {
    ready: bool,
    requested: bool,
}

impl Visibility {
    fn request_show(&mut self) -> bool {
        self.requested = true;
        self.ready
    }

    fn ready(&mut self) -> bool {
        let first_ready = !self.ready;
        self.ready = true;
        first_ready && self.requested
    }
}

pub(crate) struct HudState {
    visibility: Mutex<Visibility>,
    started: Instant,
}

impl Default for HudState {
    fn default() -> Self {
        Self {
            visibility: Mutex::new(Visibility::default()),
            started: Instant::now(),
        }
    }
}

pub(crate) fn log_startup(app: &tauri::AppHandle, stage: &str) {
    if cfg!(debug_assertions) {
        let state = app.state::<HudState>();
        eprintln!(
            "[startup +{} ms] {stage}",
            state.started.elapsed().as_millis()
        );
    }
}

#[tauri::command]
pub(crate) fn hud_ready(app: tauri::AppHandle, frontend_ms: f64) {
    log_startup(
        &app,
        &format!("Frontend ready (navigation +{frontend_ms:.0} ms)"),
    );
    let should_show = app
        .state::<HudState>()
        .visibility
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .ready();
    if should_show {
        show(&app);
    }
}

pub(crate) fn show(app: &tauri::AppHandle) {
    if !app
        .state::<HudState>()
        .visibility
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .request_show()
    {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        // Use the cursor's monitor, not the monitor where the hidden HUD last lived.
        let monitor = app
            .cursor_position()
            .ok()
            .and_then(|point| app.monitor_from_point(point.x, point.y).ok().flatten())
            .or_else(|| app.primary_monitor().ok().flatten());
        if let Some(monitor) = monitor {
            if let (Ok(size), Ok(scale)) = (window.outer_size(), window.scale_factor()) {
                let area = monitor.work_area();
                let target_scale = monitor.scale_factor();
                let width = ((f64::from(size.width) / scale * target_scale).round() as u32)
                    .min(area.size.width);
                let height = ((f64::from(size.height) / scale * target_scale).round() as u32)
                    .min(area.size.height);
                let (x, y) = centered_position(
                    area.position.x,
                    area.position.y,
                    area.size.width,
                    area.size.height,
                    width,
                    height,
                );
                let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
                let _ = window.set_size(tauri::LogicalSize::new(
                    f64::from(width) / target_scale,
                    f64::from(height) / target_scale,
                ));
            }
        }
        let _ = window.show();
        let _ = window.set_focus();
        let _ = app.emit("hud-opened", ());
    }
}

pub(crate) fn toggle(app: &tauri::AppHandle) {
    {
        let state = app.state::<HudState>();
        let mut visibility = state
            .visibility
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        if !visibility.ready {
            visibility.requested = !visibility.requested;
            return;
        }
    }
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) && !window.is_minimized().unwrap_or(false) {
            let _ = hide(app);
        } else {
            show(app);
        }
    }
}

pub(crate) fn hide(app: &tauri::AppHandle) -> Result<(), String> {
    app.state::<HudState>()
        .visibility
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .requested = false;
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub(crate) fn on_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = hide(window.app_handle());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn startup_waits_for_frontend_before_showing_requested_hud() {
        let mut visibility = Visibility::default();
        assert!(!visibility.request_show());
        assert!(visibility.ready());
        assert!(!visibility.ready()); // A frontend hot reload must not steal focus.
        assert!(visibility.request_show());
    }

    #[test]
    fn background_start_and_cancelled_show_stay_hidden_when_ready() {
        let mut background = Visibility::default();
        assert!(!background.ready());
        let mut cancelled = Visibility::default();
        assert!(!cancelled.request_show());
        cancelled.requested = false;
        assert!(!cancelled.ready());
    }
}
