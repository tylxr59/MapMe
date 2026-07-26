DROP TABLE place_fts;

CREATE VIRTUAL TABLE place_fts USING fts5(
  place_id UNINDEXED,
  name,
  address,
  description,
  tokenize = 'unicode61 remove_diacritics 2'
);

INSERT INTO place_fts (place_id, name, address, description)
SELECT
  id,
  name,
  coalesce(address, ''),
  coalesce(description, '')
FROM places;

DROP TABLE place_tags;
DROP TABLE tags;
