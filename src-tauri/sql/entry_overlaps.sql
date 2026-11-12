SELECT EXISTS (
    SELECT 1
    FROM entries
    WHERE start < ?2 AND end > ?1
);
