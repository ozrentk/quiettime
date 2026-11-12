SELECT id, app, title, kind, MAX(start, ?1), MIN(end, ?2)
FROM activity
WHERE start < ?2 AND end > ?1
ORDER BY start DESC;
