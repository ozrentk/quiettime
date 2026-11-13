INSERT OR IGNORE INTO git_commits
    (repository_id, sha, subject, author_name, author_email, authored_at, committed_at)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7);
