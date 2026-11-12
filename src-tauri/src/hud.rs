use crate::utils::centered_position;
use tauri::{Emitter, Manager};

pub(crate) fn show(app: &tauri::AppHandle) {
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
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) && !window.is_minimized().unwrap_or(false) {
            let _ = window.hide();
        } else {
            show(app);
        }
    }
}

pub(crate) fn hide(app: &tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub(crate) fn on_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
    }
}
