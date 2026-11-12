use crate::{
    activity, hud,
    state::{lock, State},
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    Manager,
};

// Keep the tray controls accessible for the entire application lifetime.
struct TrayControls {
    icon: TrayIcon,
    start: MenuItem<tauri::Wry>,
    stop: MenuItem<tauri::Wry>,
}

pub(crate) fn sync(app: &tauri::AppHandle, paused: bool) {
    if let Some(tray) = app.try_state::<TrayControls>() {
        let _ = tray.start.set_enabled(paused);
        let _ = tray.stop.set_enabled(!paused);
        let _ = tray.icon.set_tooltip(Some(if paused {
            "Quiet Time — tracking stopped · click to show/hide"
        } else {
            "Quiet Time — tracking active · click to show/hide"
        }));
        let _ = tray.icon.set_icon(Some(tray_image(paused)));
    }
}

fn tray_image(paused: bool) -> tauri::image::Image<'static> {
    let mut pixels = vec![0u8; 32 * 32 * 4];
    for y in 3usize..29 {
        for x in 3usize..29 {
            let index = (y * 32 + x) * 4;
            let hand = (14..=17).contains(&x) && (8..=17).contains(&y)
                || (14..=24).contains(&x) && (14..=17).contains(&y);
            let color = if hand {
                [20, 30, 28, 255]
            } else if paused {
                [240, 190, 110, 255]
            } else {
                [137, 224, 180, 255]
            };
            pixels[index..index + 4].copy_from_slice(&color);
        }
    }
    tauri::image::Image::new_owned(pixels, 32, 32)
}

pub(crate) fn setup(app: &tauri::AppHandle, paused: bool) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Quiet Time", true, None::<&str>)?;
    let start = MenuItem::with_id(app, "start", "Start tracking", paused, None::<&str>)?;
    let stop = MenuItem::with_id(app, "stop", "Stop tracking", !paused, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &start, &stop, &quit])?;
    let icon = TrayIconBuilder::with_id("quiet-time")
        .icon(tray_image(paused))
        .tooltip("Quiet Time — local timesheet companion")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                hud::toggle(tray.app_handle());
            }
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => hud::show(app),
            "start" | "stop" => {
                if let Err(error) =
                    activity::set_paused(app, &app.state::<State>(), event.id.as_ref() == "stop")
                {
                    if let Ok(mut core) = lock(&app.state::<State>()) {
                        core.capture_error = Some(error);
                    }
                    hud::show(app);
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    app.manage(TrayControls { icon, start, stop });
    sync(app, paused);
    Ok(())
}
