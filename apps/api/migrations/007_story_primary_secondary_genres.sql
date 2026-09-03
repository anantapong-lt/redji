BEGIN;

ALTER TABLE stories
  ADD COLUMN primary_genre_id UUID NOT NULL
    REFERENCES genres(id) ON DELETE RESTRICT,
  ADD COLUMN secondary_genre_id UUID
    REFERENCES genres(id) ON DELETE RESTRICT,
  ADD CONSTRAINT stories_genres_must_be_different_check
    CHECK (
      secondary_genre_id IS NULL
      OR primary_genre_id <> secondary_genre_id
    );

CREATE INDEX stories_primary_genre_id_idx ON stories (primary_genre_id);
CREATE INDEX stories_secondary_genre_id_idx
  ON stories (secondary_genre_id)
  WHERE secondary_genre_id IS NOT NULL;

DROP TABLE story_genres;

INSERT INTO schema_migrations (version)
VALUES ('007_story_primary_secondary_genres');

COMMIT;
