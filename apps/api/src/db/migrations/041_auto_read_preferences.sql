-- 041_auto_read_preferences.sql
-- Reader automation is per account and work, not a browser-only preference.
-- This makes a deliberate auto-purchase choice available on every device.

CREATE TABLE IF NOT EXISTS user_work_auto_read_preferences (
  user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p_id          BIGINT NOT NULL REFERENCES works(p_id) ON DELETE CASCADE,
  auto_next     BOOLEAN NOT NULL DEFAULT FALSE,
  auto_purchase BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, p_id),
  CHECK (NOT auto_purchase OR auto_next)
);

CREATE INDEX IF NOT EXISTS idx_user_work_auto_read_preferences_work
  ON user_work_auto_read_preferences(p_id);
