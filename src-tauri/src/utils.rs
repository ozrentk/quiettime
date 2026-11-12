use std::time::{SystemTime, UNIX_EPOCH};

pub fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

pub fn centered_position(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    hud_width: u32,
    hud_height: u32,
) -> (i32, i32) {
    (
        x + (width.saturating_sub(hud_width) / 2) as i32,
        y + (height.saturating_sub(hud_height) / 2) as i32,
    )
}

#[cfg(test)]
mod hud_tests {
    use super::centered_position;

    #[test]
    fn centers_on_secondary_monitor_with_negative_origin_and_taskbar_space() {
        assert_eq!(
            centered_position(-1920, 40, 1920, 1040, 580, 740),
            (-1250, 190)
        );
        // Physical dimensions for a HUD on a monitor scaled to 150%.
        assert_eq!(
            centered_position(1920, 0, 2560, 1400, 870, 1110),
            (2765, 145)
        );
    }
}
