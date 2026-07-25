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

CREATE INDEX geocoding_cache_expiry_idx ON geocoding_cache(expires_at);
