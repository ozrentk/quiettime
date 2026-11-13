use crate::{
    state::{lock, State},
    store::Store,
};
use serde::{Deserialize, Serialize};
use std::{
    sync::Condvar,
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager};

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(default, rename_all = "camelCase")]
pub(crate) struct TimingSettings {
    pub activity_seconds: u64,
    pub idle_seconds: u64,
    pub git_seconds: u64,
    pub refresh_seconds: u64,
}
impl Default for TimingSettings {
    fn default() -> Self {
        Self {
            activity_seconds: 5,
            idle_seconds: 60,
            git_seconds: 60,
            refresh_seconds: 5,
        }
    }
}
impl TimingSettings {
    pub fn validate(&self) -> Result<(), String> {
        for (value, min, max, label) in [
            (self.activity_seconds, 1, 60, "Activity sampling"),
            (self.idle_seconds, 15, 3600, "Idle threshold"),
            (self.git_seconds, 15, 86400, "Git import interval"),
            (self.refresh_seconds, 1, 60, "HUD refresh"),
        ] {
            if !(min..=max).contains(&value) {
                return Err(format!("{label} must be {min}–{max} seconds."));
            }
        }
        if self.idle_seconds < self.activity_seconds {
            return Err("Idle threshold must be at least the activity sampling interval.".into());
        }
        Ok(())
    }
    pub fn max_gap_ms(&self) -> i64 {
        self.activity_seconds as i64 * 2000
    }
}

pub(crate) fn load(store: &Store) -> Result<TimingSettings, String> {
    let saved = store.setting("timing", "{}")?;
    let settings = serde_json::from_str::<TimingSettings>(&saved).unwrap_or_default();
    Ok(if settings.validate().is_ok() {
        settings
    } else {
        TimingSettings::default()
    })
}

#[derive(Default)]
pub(crate) struct Schedule(pub Condvar);
pub(crate) enum Interval {
    Activity,
    Git,
}

// Sleep until the deadline, waking on settings changes to recalculate it. No polling.
pub(crate) fn wait(app: &tauri::AppHandle, interval: Interval, since: Instant) -> bool {
    let state = app.state::<State>();
    let schedule = app.state::<Schedule>();
    let Ok(mut core) = lock(&state) else {
        return false;
    };
    let paused = core.paused;
    loop {
        if core.paused != paused {
            return true;
        }
        let seconds = match interval {
            Interval::Activity => core.timings.activity_seconds,
            Interval::Git => core.timings.git_seconds,
        };
        let remaining = Duration::from_secs(seconds).saturating_sub(since.elapsed());
        if remaining.is_zero() {
            return true;
        }
        match schedule.0.wait_timeout(core, remaining) {
            Ok((guard, _)) => core = guard,
            Err(_) => return false,
        }
    }
}

#[tauri::command]
pub(crate) fn set_timing(
    app: tauri::AppHandle,
    state: tauri::State<State>,
    timings: TimingSettings,
) -> Result<(), String> {
    timings.validate()?;
    {
        let mut core = lock(&state)?;
        core.store.set_setting(
            "timing",
            &serde_json::to_string(&timings).map_err(|e| e.to_string())?,
        )?;
        if core.timings.activity_seconds != timings.activity_seconds
            || core.timings.idle_seconds != timings.idle_seconds
        {
            core.previous = None;
        }
        core.timings = timings;
    }
    app.state::<Schedule>().0.notify_all();
    let _ = app.emit("timing-changed", ());
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn timing_defaults_persist_and_invalid_settings_are_rejected() {
        let store = Store::new(rusqlite::Connection::open_in_memory().unwrap()).unwrap();
        assert_eq!(load(&store).unwrap(), TimingSettings::default());
        let custom = TimingSettings {
            activity_seconds: 30,
            idle_seconds: 120,
            git_seconds: 300,
            refresh_seconds: 10,
        };
        custom.validate().unwrap();
        store
            .set_setting("timing", &serde_json::to_string(&custom).unwrap())
            .unwrap();
        assert_eq!(load(&store).unwrap(), custom);
        assert_eq!(custom.max_gap_ms(), 60_000);
        for invalid in [
            TimingSettings {
                git_seconds: 0,
                ..custom
            },
            TimingSettings {
                activity_seconds: 61,
                ..custom
            },
            TimingSettings {
                idle_seconds: 15,
                ..custom
            },
            TimingSettings {
                refresh_seconds: 0,
                ..custom
            },
        ] {
            assert!(invalid.validate().is_err());
        }
        store.set_setting("timing", "{broken").unwrap();
        assert_eq!(load(&store).unwrap(), TimingSettings::default());
    }
}
