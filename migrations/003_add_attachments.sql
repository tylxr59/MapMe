CREATE TABLE attachments (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  storage_name TEXT NOT NULL UNIQUE,
  thumbnail_storage_name TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL CHECK (length(original_name) BETWEEN 1 AND 255),
  media_type TEXT NOT NULL CHECK (media_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
) STRICT;

CREATE INDEX attachments_place_idx ON attachments(place_id, sort_order, created_at);
