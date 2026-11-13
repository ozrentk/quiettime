SELECT r.id, r.path, r.name, p.name, r.import_from, r.since, r.authors,
       r.all_authors, r.revision, r.last_sync, r.error
FROM git_repositories r
JOIN projects p ON p.id = r.project_id
ORDER BY r.name COLLATE NOCASE, r.path;
