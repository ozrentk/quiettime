SELECT id, project, note, start, end
FROM entries
WHERE start < ?2 AND end > ?1
ORDER BY start DESC;
