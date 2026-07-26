CREATE TABLE lists (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  normalized_name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

INSERT INTO lists
  (id, name, normalized_name, sort_order, is_system, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-000000000101', 'Saved for later', 'saved for later', 30, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000102', 'Want to go', 'want to go', 20, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000103', 'Visited', 'visited', 10, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE places
ADD COLUMN list_id TEXT REFERENCES lists(id) ON DELETE RESTRICT;

UPDATE places
SET list_id = CASE status
  WHEN 'visited' THEN '00000000-0000-4000-8000-000000000103'
  WHEN 'want_to_go' THEN '00000000-0000-4000-8000-000000000102'
  ELSE '00000000-0000-4000-8000-000000000101'
END;

CREATE INDEX places_list_idx ON places(list_id, is_archived);

CREATE TRIGGER places_list_required_insert
BEFORE INSERT ON places
WHEN NEW.list_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'list_id is required');
END;

CREATE TRIGGER places_list_required_update
BEFORE UPDATE OF list_id ON places
WHEN NEW.list_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'list_id is required');
END;

CREATE TABLE place_links (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  title TEXT CHECK (title IS NULL OR length(title) <= 200),
  url TEXT NOT NULL CHECK (length(url) BETWEEN 1 AND 2048),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX place_links_place_idx ON place_links(place_id, sort_order, created_at);

INSERT INTO place_links (id, place_id, title, url, sort_order, created_at)
SELECT
  lower(
    substr(hex(randomblob(16)), 1, 8) || '-' ||
    substr(hex(randomblob(16)), 1, 4) || '-4' ||
    substr(hex(randomblob(16)), 1, 3) || '-8' ||
    substr(hex(randomblob(16)), 1, 3) || '-' ||
    substr(hex(randomblob(16)), 1, 12)
  ),
  id,
  NULL,
  source_url,
  0,
  created_at
FROM places
WHERE source_url IS NOT NULL AND source_url != '';
