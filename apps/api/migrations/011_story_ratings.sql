BEGIN;

CREATE TABLE story_ratings (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, story_id),
  CONSTRAINT story_ratings_rating_check CHECK (rating BETWEEN 1 AND 5)
);

CREATE INDEX story_ratings_story_id_idx ON story_ratings (story_id);

INSERT INTO schema_migrations (version) VALUES ('011_story_ratings');

COMMIT;
