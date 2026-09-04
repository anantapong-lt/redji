BEGIN;

ALTER TABLE stories
  ADD COLUMN cover_blur_data_url TEXT;

INSERT INTO schema_migrations (version) VALUES ('010_story_cover_blur_data_url');

COMMIT;
