use super::{
    models::{Repository, RepositoryInput},
    reader, service,
};
use crate::store::Store;
use std::{
    path::PathBuf,
    process::Command,
    sync::atomic::{AtomicUsize, Ordering},
};

static NEXT_ID: AtomicUsize = AtomicUsize::new(0);
const SINCE: i64 = 1_700_000_000_000;

struct TestRepo(PathBuf);
impl TestRepo {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!(
            "quiet-time-git-test-{}-{}-{} with spaces",
            std::process::id(),
            crate::utils::now(),
            NEXT_ID.fetch_add(1, Ordering::Relaxed)
        ));
        std::fs::create_dir_all(&path).unwrap();
        let repo = Self(path);
        repo.run(&["init", "-q"], None);
        repo.run(&["config", "user.name", "Quiet Time Test"], None);
        repo.run(&["config", "user.email", "me@example.test"], None);
        repo
    }
    fn run(&self, args: &[&str], identity: Option<(&str, i64)>) -> String {
        let mut command = Command::new("git");
        command
            .args([
                "-c",
                "core.hooksPath=",
                "-c",
                "commit.gpgSign=false",
                "-c",
                "gc.auto=0",
                "-C",
            ])
            .arg(&self.0)
            .args(args);
        for key in [
            "GIT_DIR",
            "GIT_WORK_TREE",
            "GIT_COMMON_DIR",
            "GIT_INDEX_FILE",
        ] {
            command.env_remove(key);
        }
        if let Some((email, timestamp)) = identity {
            command
                .env("GIT_AUTHOR_NAME", "Quiet Time Test")
                .env("GIT_AUTHOR_EMAIL", email)
                .env("GIT_COMMITTER_NAME", "Quiet Time Test")
                .env("GIT_COMMITTER_EMAIL", email)
                .env("GIT_AUTHOR_DATE", format!("@{} +0000", timestamp / 1000))
                .env("GIT_COMMITTER_DATE", format!("@{} +0000", timestamp / 1000));
        }
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let output = command.output().unwrap();
        assert!(
            output.status.success(),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    }
    fn commit(&self, subject: &str, email: &str, at: i64) {
        self.run(
            &["commit", "--allow-empty", "-q", "-m", subject],
            Some((email, at)),
        );
    }
}
impl Drop for TestRepo {
    fn drop(&mut self) {
        // Delete only the uniquely created test folder after verifying its resolved location.
        if let (Ok(path), Ok(temp)) = (self.0.canonicalize(), std::env::temp_dir().canonicalize()) {
            if path.starts_with(temp)
                && path
                    .file_name()
                    .is_some_and(|name| name.to_string_lossy().starts_with("quiet-time-git-test-"))
            {
                let _ = std::fs::remove_dir_all(path);
            }
        }
    }
}

fn input(repo: &TestRepo) -> RepositoryInput {
    RepositoryInput {
        id: None,
        path: repo.0.to_string_lossy().to_string(),
        project: "Work".into(),
        import_from: "2023-11-14".into(),
        since: SINCE,
        authors: vec!["me@example.test".into()],
        all_authors: false,
    }
}
fn database() -> Store {
    let store = Store::new(rusqlite::Connection::open_in_memory().unwrap()).unwrap();
    store.save_project("Work").unwrap();
    store
}
fn register(store: &Store, repo: &TestRepo) -> Repository {
    let inspection = reader::inspect(&repo.0.to_string_lossy()).unwrap();
    assert!(inspection.authors.contains(&"me@example.test".to_string()));
    store
        .git_save_repository(&input(repo), &inspection)
        .unwrap();
    store.git_repositories().unwrap().remove(0)
}

#[test]
fn imports_local_branches_filters_author_and_date_and_never_creates_entries() {
    let repo = TestRepo::new();
    repo.commit("Before import date", "me@example.test", SINCE - 60_000);
    repo.commit("Someone else", "other@example.test", SINCE + 60_000);
    repo.commit(
        "Subject with ünicode and\ta tab",
        "ME@example.test",
        SINCE + 120_000,
    );
    let branch = repo.run(&["symbolic-ref", "--short", "HEAD"], None);
    repo.run(&["checkout", "-q", "-b", "codex/unmerged"], None);
    repo.commit("Unmerged work", "me@example.test", SINCE + 180_000);
    repo.run(&["checkout", "-q", &branch], None);
    let store = database();
    let registered = register(&store, &repo);
    let commits = reader::read(&registered).unwrap();
    assert_eq!(commits.len(), 2);
    assert!(commits
        .iter()
        .any(|commit| commit.subject.contains("ünicode")));
    assert!(commits
        .iter()
        .any(|commit| commit.subject == "Unmerged work"));
    store.git_store_import(&registered, &commits, 1).unwrap();
    store.git_store_import(&registered, &commits, 2).unwrap();
    assert_eq!(
        store.git_timeline(None, None, None, 100).unwrap().0.len(),
        2
    );
    assert!(store.entries(0, i64::MAX).unwrap().is_empty());
    let (page, more) = store
        .git_timeline(Some(registered.id), None, None, 1)
        .unwrap();
    assert_eq!(page.len(), 1);
    assert!(more);
    assert_eq!(store.git_repositories().unwrap()[0].last_sync, Some(2));
}

#[test]
fn changed_settings_reject_stale_imports_and_all_authors_include_others() {
    let repo = TestRepo::new();
    repo.commit("Own", "me@example.test", SINCE + 60_000);
    repo.commit("Other", "other@example.test", SINCE + 120_000);
    let store = database();
    let old = register(&store, &repo);
    let commits = reader::read(&old).unwrap();
    store.git_store_import(&old, &commits, 1).unwrap();
    let mut updated = input(&repo);
    updated.id = Some(old.id);
    updated.all_authors = true;
    store
        .git_save_repository(&updated, &reader::inspect(&updated.path).unwrap())
        .unwrap();
    assert!(!store.git_store_import(&old, &commits, 2).unwrap());
    assert!(store
        .git_timeline(None, None, None, 100)
        .unwrap()
        .0
        .is_empty());
    let current = store.git_repositories().unwrap().remove(0);
    assert_eq!(current.import_from, "2023-11-14");
    assert_eq!(current.since, SINCE);
    let store = Store::new(store.0).unwrap();
    assert_eq!(
        store.git_repositories().unwrap()[0].import_from,
        "2023-11-14"
    );
    assert!(store.git_repositories().unwrap()[0].all_authors);
    let all = reader::read(&current).unwrap();
    assert_eq!(all.len(), 2);
    store.git_store_import(&current, &all, 3).unwrap();
    store
        .git_import_error(&current, "Unavailable folder")
        .unwrap();
    assert_eq!(
        store.git_timeline(None, None, None, 100).unwrap().0.len(),
        2
    );
    assert_eq!(
        store.git_repositories().unwrap()[0].error.as_deref(),
        Some("Unavailable folder")
    );
    store.git_delete_repository(current.id).unwrap();
    assert!(store
        .git_timeline(None, None, None, 100)
        .unwrap()
        .0
        .is_empty());
    assert!(store.git_repositories().unwrap().is_empty());
}

#[test]
fn empty_repositories_and_invalid_paths_are_handled() {
    let repo = TestRepo::new();
    let store = database();
    let registered = register(&store, &repo);
    assert!(reader::read(&registered).unwrap().is_empty());
    let mut nested = registered.clone();
    let nested_path = repo.0.join("nested folder");
    std::fs::create_dir(&nested_path).unwrap();
    nested.path = nested_path.to_string_lossy().to_string();
    assert!(reader::read(&nested).is_err());
    assert!(reader::inspect(&repo.0.join("missing").to_string_lossy()).is_err());
    assert!(store
        .git_save_repository(
            &input(&repo),
            &reader::inspect(&repo.0.to_string_lossy()).unwrap()
        )
        .is_err());
}

#[test]
fn validates_dates_and_exact_email_filters() {
    let repo = TestRepo::new();
    let mut value = input(&repo);
    value.import_from = "2026-02-30".into();
    assert!(service::validate(&mut value).is_err());
    value.import_from = "2024-02-29".into();
    value.authors = vec![" me@example.test ".into(), "ME@example.test".into()];
    service::validate(&mut value).unwrap();
    assert_eq!(value.authors.len(), 1);
    value.authors.clear();
    assert!(service::validate(&mut value).is_err());
    value.all_authors = true;
    service::validate(&mut value).unwrap();
}
