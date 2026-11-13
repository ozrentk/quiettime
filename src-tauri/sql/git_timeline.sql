SELECT c.repository_id, r.name, p.name, c.sha, c.subject, c.author_name,
       c.author_email, c.authored_at, c.committed_at
FROM git_commits c
JOIN git_repositories r ON r.id = c.repository_id
JOIN projects p ON p.id = r.project_id
WHERE (?1 IS NULL OR c.repository_id = ?1)
  AND (?2 IS NULL OR c.committed_at >= ?2)
  AND (?3 IS NULL OR c.committed_at < ?3)
ORDER BY c.committed_at DESC, c.repository_id, c.sha
LIMIT ?4;
