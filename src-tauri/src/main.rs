#![cfg_attr(windows, windows_subsystem = "windows")]

mod activity;
mod commands;
mod hud;
mod platform;
mod sql;
mod startup;
mod state;
mod store;
mod tray;
mod utils;

use tauri_plugin_global_shortcut::ShortcutState;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _| {
            if !startup::is_background(args) {
                hud::show(app);
            }
        }))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _, event| {
                    if event.state() == ShortcutState::Pressed {
                        hud::toggle(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            let paused = state::initialize(app.handle())?;
            tray::setup(app.handle(), paused)?;
            if !startup::is_background(std::env::args()) {
                hud::show(app.handle());
            }
            activity::spawn(app.handle().clone());
            Ok(())
        })
        .on_window_event(hud::on_window_event)
        .invoke_handler(tauri::generate_handler![
            commands::dashboard,
            commands::add_entry,
            commands::save_project,
            commands::add_manual_entry,
            commands::delete_entry,
            commands::set_paused,
            commands::set_startup,
            commands::set_capture_titles,
            commands::set_shortcut,
            commands::hide_hud
        ])
        .run(tauri::generate_context!())
        .expect("Quiet Time could not start");
}
