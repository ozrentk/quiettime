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

PRAGMA user_version = 2;
