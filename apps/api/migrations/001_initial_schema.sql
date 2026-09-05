BEGIN;

CREATE TYPE user_role AS ENUM ('user', 'writer', 'super_admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'banned');
CREATE TYPE oauth_provider AS ENUM ('google');
CREATE TYPE story_type AS ENUM ('novel', 'manga');
CREATE TYPE story_status AS ENUM (
  'draft',
  'ongoing',
  'completed',
  'hiatus',
  'cancelled'
);
CREATE TYPE chapter_status AS ENUM ('draft', 'scheduled', 'published', 'hidden');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL,
  username VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(16),
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'user',
  status user_status NOT NULL DEFAULT 'active',
  email_verified_at TIMESTAMPTZ,
  phone_verified_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT users_phone_number_format_check
    CHECK (phone_number IS NULL OR phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  CONSTRAINT users_phone_verification_check
    CHECK (phone_verified_at IS NULL OR phone_number IS NOT NULL)
);

CREATE UNIQUE INDEX users_email_unique_idx ON users (LOWER(email));
CREATE UNIQUE INDEX users_username_unique_idx ON users (LOWER(username));
CREATE UNIQUE INDEX users_phone_number_unique_idx
  ON users (phone_number)
  WHERE phone_number IS NOT NULL;

CREATE TABLE user_password_credentials (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider oauth_provider NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  provider_email VARCHAR(320),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_oauth_accounts_provider_account_unique
    UNIQUE (provider, provider_account_id),
  CONSTRAINT user_oauth_accounts_user_provider_unique
    UNIQUE (user_id, provider)
);

CREATE INDEX user_oauth_accounts_user_id_idx ON user_oauth_accounts (user_id);

CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type story_type NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  synopsis TEXT,
  cover_url TEXT,
  status story_status NOT NULL DEFAULT 'draft',
  age_rating SMALLINT,
  total_views BIGINT NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT stories_age_rating_check
    CHECK (age_rating IS NULL OR age_rating >= 0),
  CONSTRAINT stories_total_views_check CHECK (total_views >= 0)
);

CREATE UNIQUE INDEX stories_slug_unique_idx ON stories (LOWER(slug));
CREATE INDEX stories_type_status_published_at_idx
  ON stories (type, status, published_at DESC);
CREATE INDEX stories_status_updated_at_idx
  ON stories (status, updated_at DESC);
CREATE INDEX stories_creator_user_id_idx ON stories (creator_user_id);

CREATE TABLE genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX genres_name_unique_idx ON genres (LOWER(name));
CREATE UNIQUE INDEX genres_slug_unique_idx ON genres (LOWER(slug));

CREATE TABLE story_genres (
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  genre_id UUID NOT NULL REFERENCES genres(id) ON DELETE RESTRICT,
  PRIMARY KEY (story_id, genre_id)
);

CREATE INDEX story_genres_genre_id_idx ON story_genres (genre_id);

CREATE TABLE chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  chapter_number NUMERIC(10, 1) NOT NULL,
  title VARCHAR(255) NOT NULL,
  status chapter_status NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chapters_story_number_unique UNIQUE (story_id, chapter_number),
  CONSTRAINT chapters_number_check CHECK (chapter_number >= 0)
);

CREATE INDEX chapters_story_status_number_idx
  ON chapters (story_id, status, chapter_number DESC);
CREATE INDEX chapters_status_published_at_idx
  ON chapters (status, published_at DESC);

CREATE TABLE novel_chapter_contents (
  chapter_id UUID PRIMARY KEY REFERENCES chapters(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT novel_chapter_contents_word_count_check CHECK (word_count >= 0)
);

CREATE TABLE manga_chapter_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  alt_text VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT manga_chapter_pages_chapter_page_unique
    UNIQUE (chapter_id, page_number),
  CONSTRAINT manga_chapter_pages_page_number_check CHECK (page_number > 0),
  CONSTRAINT manga_chapter_pages_width_check CHECK (width IS NULL OR width > 0),
  CONSTRAINT manga_chapter_pages_height_check CHECK (height IS NULL OR height > 0)
);

CREATE OR REPLACE FUNCTION enforce_chapter_content_type()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  expected_type story_type;
BEGIN
  SELECT stories.type
    INTO expected_type
    FROM chapters
    JOIN stories ON stories.id = chapters.story_id
   WHERE chapters.id = NEW.chapter_id;

  IF TG_TABLE_NAME = 'novel_chapter_contents' AND expected_type <> 'novel' THEN
    RAISE EXCEPTION 'Novel content can only belong to a novel chapter';
  END IF;

  IF TG_TABLE_NAME = 'manga_chapter_pages' AND expected_type <> 'manga' THEN
    RAISE EXCEPTION 'Manga pages can only belong to a manga chapter';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER novel_chapter_content_type_trigger
BEFORE INSERT OR UPDATE OF chapter_id ON novel_chapter_contents
FOR EACH ROW EXECUTE FUNCTION enforce_chapter_content_type();

CREATE TRIGGER manga_chapter_page_type_trigger
BEFORE INSERT OR UPDATE OF chapter_id ON manga_chapter_pages
FOR EACH ROW EXECUTE FUNCTION enforce_chapter_content_type();

CREATE TABLE schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (version) VALUES ('001_initial_schema');

COMMIT;
