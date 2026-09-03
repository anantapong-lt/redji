BEGIN;

CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX auth_sessions_refresh_token_hash_unique_idx
  ON auth_sessions (refresh_token_hash);
CREATE INDEX auth_sessions_user_id_active_idx
  ON auth_sessions (user_id, expires_at)
  WHERE revoked_at IS NULL;

INSERT INTO schema_migrations (version) VALUES ('002_auth_sessions');

COMMIT;
