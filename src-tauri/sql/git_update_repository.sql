UPDATE git_repositories
SET path = ?2, name = ?3, project_id = ?4, import_from = ?5, since = ?6,
    authors = ?7, all_authors = ?8, revision = revision + 1,
    last_sync = NULL, error = NULL
WHERE id = ?1;
