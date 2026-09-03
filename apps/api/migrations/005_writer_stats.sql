BEGIN;

CREATE TABLE story_favorites (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, story_id)
);

CREATE INDEX story_favorites_story_id_idx ON story_favorites (story_id);

ALTER TABLE chapters
  ADD COLUMN is_free BOOLEAN NOT NULL DEFAULT TRUE;

INSERT INTO schema_migrations (version) VALUES ('005_writer_stats');

COMMIT;
