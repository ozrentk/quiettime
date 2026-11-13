UPDATE git_repositories SET last_sync = ?3, error = NULL
WHERE id = ?1 AND revision = ?2;
