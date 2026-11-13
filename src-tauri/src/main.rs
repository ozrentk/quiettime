#![cfg_attr(windows, windows_subsystem = "windows")]

mod activity;
mod commands;
#[cfg(all(dev, windows))]
mod dev_session;
mod git;
mod hud;
mod platform;
mod sql;
mod startup;
mod state;
mod store;
mod timing;
mod tray;
mod utils;

use tauri::Manager;
use tauri_plugin_global_shortcut::ShortcutState;

fn main() {
    tauri::Builder::default()
        .manage(hud::HudState::default())
        .manage(timing::Schedule::default())
        .manage(git::service::ImportState::default())
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
            hud::log_startup(app.handle(), "WebView created; initializing local state");
            let paused = state::initialize(app.handle())?;
            hud::log_startup(app.handle(), "Local state initialized");
            tray::setup(app.handle(), paused)?;
            #[cfg(all(dev, windows))]
            dev_session::spawn(app.handle().clone())?;
            if !startup::is_background(std::env::args()) {
                hud::show(app.handle());
            }
            activity::spawn(app.handle().clone());
            git::service::spawn(app.handle().clone());
            hud::log_startup(app.handle(), "Native setup complete; waiting for frontend");
            Ok(())
        })
        .on_window_event(hud::on_window_event)
        .on_page_load(|webview, payload| {
            hud::log_startup(
                webview.app_handle(),
                &format!("Navigation {:?}", payload.event()),
            );
        })
        .invoke_handler(tauri::generate_handler![
            commands::dashboard,
            timing::set_timing,
            hud::hud_ready,
            commands::add_entry,
            commands::save_project,
            commands::add_manual_entry,
            commands::delete_entry,
            commands::set_paused,
            commands::set_startup,
            commands::set_capture_titles,
            commands::set_shortcut,
            commands::hide_hud,
            git::commands::git_snapshot,
            git::commands::git_inspect,
            git::commands::git_save_repository,
            git::commands::git_remove_repository,
            git::commands::git_refresh,
            git::commands::git_pick_folder
        ])
        .run(tauri::generate_context!())
        .expect("Quiet Time could not start");
}
