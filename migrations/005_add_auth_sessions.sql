CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  password_fingerprint TEXT NOT NULL CHECK (length(password_fingerprint) = 64),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
) STRICT;

CREATE INDEX auth_sessions_expiry_idx ON auth_sessions(expires_at);
