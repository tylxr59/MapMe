CREATE TABLE categories (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  normalized_name TEXT NOT NULL UNIQUE,
  icon_name TEXT NOT NULL CHECK (length(icon_name) BETWEEN 1 AND 80),
  color TEXT NOT NULL CHECK (length(color) = 7 AND color GLOB '#[0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f][0-9A-Fa-f]'),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 0 CHECK (is_system IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE places (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  normalized_name TEXT NOT NULL,
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  address TEXT CHECK (address IS NULL OR length(address) <= 500),
  description TEXT CHECK (description IS NULL OR length(description) <= 20000),
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'saved' CHECK (status IN ('saved', 'want_to_go', 'visited')),
  is_favorite INTEGER NOT NULL DEFAULT 0 CHECK (is_favorite IN (0, 1)),
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
  rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  date_visited TEXT CHECK (date_visited IS NULL OR length(date_visited) = 10),
  source_url TEXT CHECK (source_url IS NULL OR length(source_url) <= 2048),
  extra_properties_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE tags (
  id TEXT PRIMARY KEY CHECK (length(id) = 36),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  normalized_name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE place_tags (
  place_id TEXT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (place_id, tag_id)
) WITHOUT ROWID, STRICT;

CREATE TABLE settings (
  key TEXT PRIMARY KEY CHECK (length(key) BETWEEN 1 AND 100),
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

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

CREATE TABLE geocoding_cache (
  cache_key TEXT PRIMARY KEY CHECK (length(cache_key) = 64),
  provider TEXT NOT NULL,
  endpoint_fingerprint TEXT NOT NULL,
  request_kind TEXT NOT NULL CHECK (request_kind IN ('forward', 'reverse')),
  normalized_query TEXT NOT NULL,
  request_json TEXT NOT NULL,
  response_json TEXT NOT NULL,
  result_count INTEGER NOT NULL CHECK (result_count > 0),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
) STRICT;

CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  password_fingerprint TEXT NOT NULL CHECK (length(password_fingerprint) = 64),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
) STRICT;

CREATE VIRTUAL TABLE place_fts USING fts5(
  place_id UNINDEXED,
  name,
  address,
  description,
  tags,
  tokenize = 'unicode61 remove_diacritics 2'
);

CREATE INDEX places_category_idx ON places(category_id);
CREATE INDEX places_status_idx ON places(status, is_archived);
CREATE INDEX places_updated_idx ON places(updated_at DESC);
CREATE INDEX place_tags_tag_idx ON place_tags(tag_id, place_id);
CREATE INDEX attachments_place_idx ON attachments(place_id, sort_order, created_at);
CREATE INDEX geocoding_cache_expiry_idx ON geocoding_cache(expires_at);
CREATE INDEX auth_sessions_expiry_idx ON auth_sessions(expires_at);

INSERT INTO categories
  (id, name, normalized_name, icon_name, color, sort_order, is_system, created_at, updated_at)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Restaurant', 'restaurant', 'utensils', '#E76F51', 10, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000002', 'Hiking', 'hiking', 'footprints', '#2A9D8F', 20, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000003', 'Coffee', 'coffee', 'coffee', '#9C6644', 30, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000004', 'Shopping', 'shopping', 'shopping-bag', '#8E7DBE', 40, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000005', 'Scenic', 'scenic', 'mountain-snow', '#457B9D', 50, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000006', 'Photography', 'photography', 'camera', '#F4A261', 60, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000007', 'Entertainment', 'entertainment', 'ticket', '#E63946', 70, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-4000-8000-000000000008', 'Other', 'other', 'pin', '#5B6472', 999, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO settings (key, value_json, updated_at)
VALUES ('instance_id', json_quote(lower(hex(randomblob(16)))), CURRENT_TIMESTAMP);
