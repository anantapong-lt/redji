BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS profile_cover_url TEXT,
  ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '{}'::JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_bio_length_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_bio_length_check CHECK (bio IS NULL OR char_length(bio) <= 500);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_social_links_object_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_social_links_object_check CHECK (jsonb_typeof(social_links) = 'object');
  END IF;
END $$;

COMMIT;
