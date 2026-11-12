CREATE TABLE entries (
    id INTEGER PRIMARY KEY,
    project TEXT NOT NULL,
    note TEXT NOT NULL,
    start INTEGER NOT NULL,
    end INTEGER NOT NULL
);

INSERT INTO entries VALUES (1, 'Existing project', '', 0, 60000);
PRAGMA user_version = 1;
