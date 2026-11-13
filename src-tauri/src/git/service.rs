use super::{
    models::{RepositoryInput, SyncResult},
    reader,
};
use crate::{
    state::{lock, State},
    utils::now,
};
use std::{
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager};

#[derive(Default)]
pub(crate) struct ImportState {
    busy: AtomicBool,
}
struct ImportGuard<'a>(&'a AtomicBool);
impl Drop for ImportGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}
impl ImportState {
    pub fn is_busy(&self) -> bool {
        self.busy.load(Ordering::Acquire)
    }
    fn begin(&self) -> Result<ImportGuard<'_>, String> {
        self.busy
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| "A Git import is already running. Please wait for it to finish.")?;
        Ok(ImportGuard(&self.busy))
    }
}

pub(crate) fn validate(input: &mut RepositoryInput) -> Result<(), String> {
    // The frontend supplies local midnight alongside the saved calendar date.
    let parts: Vec<_> = input.import_from.split('-').collect();
    if parts.len() != 3 || parts[0].len() != 4 || parts[1].len() != 2 || parts[2].len() != 2 {
        return Err("Choose a valid import date".into());
    }
    let year = parts[0].parse::<u32>().unwrap_or(0);
    let month = parts[1].parse::<usize>().unwrap_or(0);
    let day = parts[2].parse::<u32>().unwrap_or(0);
    let leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
    let days = [
        0,
        31,
        if leap { 29 } else { 28 },
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31,
    ];
    if !(1970..=9999).contains(&year)
        || !(1..=12).contains(&month)
        || day == 0
        || day > days[month]
        || input.since < 0
        || input.since > now() + 86_400_000
    {
        return Err("Choose a valid import date that is not in the future".into());
    }
    if input.project.trim().is_empty() {
        return Err("Choose a project/task".into());
    }
    if input.authors.len() > 20 {
        return Err("Use up to 20 author emails".into());
    }
    let mut authors: Vec<String> = Vec::new();
    for author in &input.authors {
        let author = author.trim();
        if author.is_empty() {
            continue;
        }
        if author.len() > 254 || !author.contains('@') || author.chars().any(char::is_whitespace) {
            return Err("Enter author email addresses separated by commas".into());
        }
        if !authors
            .iter()
            .any(|existing| existing.eq_ignore_ascii_case(author))
        {
            authors.push(author.into());
        }
    }
    input.authors = authors;
    if !input.all_authors && input.authors.is_empty() {
        return Err("Add your author email(s), or select All authors".into());
    }
    Ok(())
}

pub(crate) fn sync(
    app: &tauri::AppHandle,
    repository_id: Option<i64>,
    background: bool,
) -> Result<SyncResult, String> {
    let import_state = app.state::<ImportState>();
    let guard = import_state.begin()?;
    let state = app.state::<State>();
    let repositories = lock(&state)?.store.git_repositories()?;
    if repository_id.is_some_and(|id| !repositories.iter().any(|repo| repo.id == id)) {
        return Err("Repository no longer exists".into());
    }
    let _ = app.emit("git-changed", ());
    let mut result = SyncResult {
        imported: 0,
        failed: 0,
    };
    for repo in repositories
        .into_iter()
        .filter(|repo| repository_id.is_none_or(|id| repo.id == id))
    {
        if background && lock(&state)?.paused {
            break;
        }
        // No database lock is held while Git is running.
        let imported = reader::read(&repo);
        let core = lock(&state)?;
        if background && core.paused {
            break;
        }
        match imported {
            Ok(commits) => {
                if core.store.git_store_import(&repo, &commits, now())? {
                    result.imported += commits.len();
                }
            }
            Err(error) => {
                core.store.git_import_error(&repo, &error)?;
                result.failed += 1;
            }
        }
    }
    drop(guard);
    let _ = app.emit("git-changed", ());
    Ok(result)
}

pub(crate) fn spawn(app: tauri::AppHandle) {
    thread::spawn(move || loop {
        let started = Instant::now();
        let active = lock(&app.state::<State>())
            .map(|core| !core.paused)
            .unwrap_or(false);
        if active {
            let _ = sync(&app, None, true);
        }
        thread::sleep(Duration::from_secs(60).saturating_sub(started.elapsed()));
    });
}

#[cfg(test)]
mod tests {
    use super::ImportState;
    #[test]
    fn overlapping_imports_are_rejected_and_guard_release_allows_the_next_import() {
        let state = ImportState::default();
        let guard = state.begin().unwrap();
        assert!(state.is_busy());
        assert!(state.begin().is_err());
        drop(guard);
        assert!(!state.is_busy());
        assert!(state.begin().is_ok());
    }
}
