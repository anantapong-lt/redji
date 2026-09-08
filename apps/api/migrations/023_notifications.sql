BEGIN;

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  target_url VARCHAR(500),
  data JSONB NOT NULL DEFAULT '{}'::JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_type_check CHECK (type IN ('withdrawal_approved', 'withdrawal_rejected')),
  CONSTRAINT notifications_title_check CHECK (btrim(title) <> ''),
  CONSTRAINT notifications_message_check CHECK (btrim(message) <> '')
);

CREATE INDEX notifications_user_created_at_idx
  ON notifications (user_id, created_at DESC);

CREATE INDEX notifications_unread_user_created_at_idx
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

INSERT INTO schema_migrations (version) VALUES ('023_notifications');

COMMIT;
