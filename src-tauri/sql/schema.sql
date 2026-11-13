PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY,
    project TEXT NOT NULL,
    note TEXT NOT NULL,
    start INTEGER NOT NULL,
    end INTEGER NOT NULL CHECK (end > start)
);

CREATE INDEX IF NOT EXISTS entries_time ON entries (start, end);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(name)) > 0)
);

INSERT OR IGNORE INTO projects (name)
SELECT trim(project)
FROM entries
WHERE length(trim(project)) > 0
ORDER BY id;

CREATE TABLE IF NOT EXISTS activity (
    id INTEGER PRIMARY KEY,
    app TEXT NOT NULL,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    start INTEGER NOT NULL,
    end INTEGER NOT NULL CHECK (end > start)
);

CREATE INDEX IF NOT EXISTS activity_time ON activity (start, end);

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS git_repositories (
    id INTEGER PRIMARY KEY,
    path TEXT NOT NULL COLLATE NOCASE UNIQUE,
    name TEXT NOT NULL,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    import_from TEXT NOT NULL,
    since INTEGER NOT NULL,
    authors TEXT NOT NULL,
    all_authors INTEGER NOT NULL CHECK (all_authors IN (0, 1)),
    revision INTEGER NOT NULL DEFAULT 1,
    last_sync INTEGER,
    error TEXT
);

CREATE TABLE IF NOT EXISTS git_commits (
    repository_id INTEGER NOT NULL REFERENCES git_repositories(id) ON DELETE CASCADE,
    sha TEXT NOT NULL,
    subject TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_email TEXT NOT NULL,
    authored_at INTEGER NOT NULL,
    committed_at INTEGER NOT NULL,
    PRIMARY KEY (repository_id, sha)
);

CREATE INDEX IF NOT EXISTS git_commits_time ON git_commits(committed_at DESC);

PRAGMA user_version = 3;
