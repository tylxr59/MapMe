CREATE VIRTUAL TABLE place_fts USING fts5(
  place_id UNINDEXED,
  name,
  address,
  description,
  tags,
  tokenize = 'unicode61 remove_diacritics 2'
);

INSERT INTO place_fts (place_id, name, address, description, tags)
SELECT
  p.id,
  p.name,
  coalesce(p.address, ''),
  coalesce(p.description, ''),
  coalesce((
    SELECT group_concat(t.name, ' ')
    FROM place_tags pt
    JOIN tags t ON t.id = pt.tag_id
    WHERE pt.place_id = p.id
  ), '')
FROM places p;
