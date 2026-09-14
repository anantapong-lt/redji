BEGIN;

-- Source: 001_initial_schema.sql
CREATE TYPE user_role AS ENUM ('user', 'writer', 'super_admin');
CREATE TYPE user_status AS ENUM ('active', 'banned');
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
  image_key TEXT NOT NULL,
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

-- Source: 002_auth_sessions.sql
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

-- Source: 003_writer_role.sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum
    INNER JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE pg_type.typname = 'user_role'
      AND pg_enum.enumlabel = 'admin'
  ) THEN
    ALTER TYPE user_role RENAME VALUE 'admin' TO 'writer';
  END IF;
END;
$$;

-- Source: 004_user_balance.sql
ALTER TABLE users
  ADD COLUMN balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  ADD CONSTRAINT users_balance_non_negative_check CHECK (balance >= 0);

-- Source: 005_writer_stats.sql
CREATE TABLE story_favorites (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, story_id)
);

CREATE INDEX story_favorites_story_id_idx ON story_favorites (story_id);

ALTER TABLE chapters
  ADD COLUMN is_free BOOLEAN NOT NULL DEFAULT TRUE;

-- Source: 006_seed_genres.sql
INSERT INTO genres (name, slug)
VALUES
  ('โรแมนติก', 'romantic'),
  ('โรแมนซ์แฟนตาซี', 'romance-fantasy'),
  ('BL/GL', 'bl-gl'),
  ('แฟนตาซี', 'fantasy'),
  ('แอ็กชัน', 'action'),
  ('สยองขวัญ', 'horror'),
  ('ดราม่า', 'drama'),
  ('ศิลปะการต่อสู้', 'martial-arts')
ON CONFLICT DO NOTHING;

-- Source: 007_story_primary_secondary_genres.sql
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

-- Source: 008_chapter_purchases.sql
ALTER TABLE chapters
  ADD COLUMN price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  ADD CONSTRAINT chapters_price_non_negative_check CHECK (price >= 0);

CREATE TABLE chapter_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  writer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE RESTRICT,
  price NUMERIC(12, 2) NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chapter_purchases_buyer_chapter_unique UNIQUE (buyer_user_id, chapter_id),
  CONSTRAINT chapter_purchases_price_positive_check CHECK (price > 0),
  CONSTRAINT chapter_purchases_buyer_writer_check CHECK (buyer_user_id <> writer_user_id)
);

CREATE INDEX chapter_purchases_chapter_id_idx ON chapter_purchases (chapter_id);
CREATE INDEX chapter_purchases_writer_user_id_idx
  ON chapter_purchases (writer_user_id, purchased_at DESC);

-- Source: 009_fix_genre_names_encoding.sql
INSERT INTO genres (name, slug)
VALUES
  ('โรแมนติก', 'romantic'),
  ('โรแมนซ์แฟนตาซี', 'romance-fantasy'),
  ('BL/GL', 'bl-gl'),
  ('แฟนตาซี', 'fantasy'),
  ('แอ็กชัน', 'action'),
  ('สยองขวัญ', 'horror'),
  ('ดราม่า', 'drama'),
  ('ศิลปะการต่อสู้', 'martial-arts')
ON CONFLICT (LOWER(slug)) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();

-- Source: 009_landing_pagination_indexes.sql
CREATE INDEX stories_public_popular_idx
  ON stories (total_views DESC, id DESC)
  WHERE status IN ('ongoing', 'completed') AND deleted_at IS NULL;

CREATE INDEX chapters_story_published_at_idx
  ON chapters (story_id, published_at DESC, id DESC)
  WHERE status = 'published';

-- Source: 010_story_cover_blur_data_url.sql
ALTER TABLE stories
  ADD COLUMN cover_blur_data_url TEXT;

-- Source: 011_story_ratings.sql
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

-- Source: 012_topup_transactions.sql
CREATE TYPE topup_transaction_status AS ENUM (
  'pending',
  'paid',
  'expired',
  'failed'
);

CREATE TABLE topup_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider VARCHAR(32) NOT NULL,
  provider_payment_id VARCHAR(100),
  requested_amount NUMERIC(12, 2) NOT NULL,
  amount_check_satang BIGINT,
  base_coins NUMERIC(12, 2) NOT NULL,
  bonus_coins NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  credited_coins NUMERIC(12, 2) NOT NULL,
  status topup_transaction_status NOT NULL DEFAULT 'pending',
  provider_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT topup_transactions_provider_payment_unique
    UNIQUE (provider, provider_payment_id),
  CONSTRAINT topup_transactions_requested_amount_positive_check
    CHECK (requested_amount > 0),
  CONSTRAINT topup_transactions_amount_check_satang_positive_check
    CHECK (amount_check_satang IS NULL OR amount_check_satang > 0),
  CONSTRAINT topup_transactions_base_coins_positive_check
    CHECK (base_coins > 0),
  CONSTRAINT topup_transactions_bonus_coins_non_negative_check
    CHECK (bonus_coins >= 0),
  CONSTRAINT topup_transactions_credited_coins_check
    CHECK (credited_coins = base_coins + bonus_coins),
  CONSTRAINT topup_transactions_paid_at_check
    CHECK (
      (status = 'paid' AND paid_at IS NOT NULL)
      OR (status <> 'paid' AND paid_at IS NULL)
    )
);

CREATE INDEX topup_transactions_user_created_at_idx
  ON topup_transactions (user_id, created_at DESC);

CREATE INDEX topup_transactions_pending_expires_at_idx
  ON topup_transactions (expires_at)
  WHERE status = 'pending';

-- Source: 013_email_registration_requests.sql
CREATE TABLE email_registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL,
  username VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  verification_token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX email_registration_requests_email_unique_idx
  ON email_registration_requests (LOWER(email));
CREATE UNIQUE INDEX email_registration_requests_username_unique_idx
  ON email_registration_requests (LOWER(username));
CREATE UNIQUE INDEX email_registration_requests_token_unique_idx
  ON email_registration_requests (verification_token_hash);
CREATE INDEX email_registration_requests_expires_at_idx
  ON email_registration_requests (expires_at);

-- Source: 014_story_daily_views.sql
CREATE TABLE story_daily_views (
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  view_date DATE NOT NULL,
  view_count BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (story_id, view_date),
  CONSTRAINT story_daily_views_count_check CHECK (view_count >= 0)
);

CREATE INDEX story_daily_views_weekly_ranking_idx
  ON story_daily_views (view_date, story_id)
  INCLUDE (view_count);

-- Source: 015_website_configs.sql
CREATE TABLE website_configs (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Source: 016_seed_website_configs.sql
INSERT INTO website_configs (key, value, description)
VALUES
  ('site', '{"name":"Readji","tagline":"","description":"","site_url":"http://localhost:3000","admin_url":"http://localhost:3002","coin_name":"เหรียญ"}'::JSONB, 'ข้อมูลเว็บไซต์'),
  ('topup', '{"packages":[{"amount":"50","bonus":"0"},{"amount":"100","bonus":"0"},{"amount":"300","bonus":"0"},{"amount":"500","bonus":"0"},{"amount":"1000","bonus":"0"},{"amount":"3000","bonus":"0"}]}'::JSONB, 'แพ็กเกจเติมเงิน'),
  ('withdrawal', '{"commission_percent":"10"}'::JSONB, 'ค่าคอมมิชชันถอนเงิน'),
  ('features', '{"registration":true,"writer_application":true,"comments":true,"topup":true,"withdrawals":false}'::JSONB, 'สถานะการเปิดใช้งานฟีเจอร์')
ON CONFLICT (key) DO NOTHING;

-- Source: 017_writer_bank_accounts.sql
CREATE TABLE writer_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  writer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_holder_first_name VARCHAR(100) NOT NULL,
  account_holder_last_name VARCHAR(100) NOT NULL,
  bank_code VARCHAR(20) NOT NULL,
  account_number VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT writer_bank_accounts_writer_unique UNIQUE (writer_user_id),
  CONSTRAINT writer_bank_accounts_holder_first_name_check CHECK (btrim(account_holder_first_name) <> ''),
  CONSTRAINT writer_bank_accounts_holder_last_name_check CHECK (btrim(account_holder_last_name) <> ''),
  CONSTRAINT writer_bank_accounts_bank_code_check CHECK (btrim(bank_code) <> ''),
  CONSTRAINT writer_bank_accounts_account_number_check CHECK (account_number ~ '^[0-9]{8,20}$')
);

-- Source: 018_withdrawal_requests.sql
CREATE TYPE withdrawal_request_status AS ENUM ('pending', 'approved', 'paid', 'rejected');

CREATE TABLE withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  writer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  account_holder_first_name VARCHAR(100) NOT NULL,
  account_holder_last_name VARCHAR(100) NOT NULL,
  bank_code VARCHAR(20) NOT NULL,
  account_number VARCHAR(32) NOT NULL,
  requested_amount NUMERIC(12, 2) NOT NULL,
  commission_percent NUMERIC(5, 2) NOT NULL,
  commission_amount NUMERIC(12, 2) NOT NULL,
  net_amount NUMERIC(12, 2) NOT NULL,
  status withdrawal_request_status NOT NULL DEFAULT 'pending',
  approval_note TEXT,
  rejection_reason TEXT,
  transfer_proof_key TEXT,
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT withdrawal_requests_holder_first_name_check CHECK (btrim(account_holder_first_name) <> ''),
  CONSTRAINT withdrawal_requests_holder_last_name_check CHECK (btrim(account_holder_last_name) <> ''),
  CONSTRAINT withdrawal_requests_bank_code_check CHECK (btrim(bank_code) <> ''),
  CONSTRAINT withdrawal_requests_account_number_check CHECK (account_number ~ '^[0-9]{8,20}$'),
  CONSTRAINT withdrawal_requests_requested_amount_check CHECK (requested_amount > 0),
  CONSTRAINT withdrawal_requests_commission_percent_check CHECK (commission_percent >= 0 AND commission_percent <= 100),
  CONSTRAINT withdrawal_requests_commission_amount_check CHECK (commission_amount >= 0),
  CONSTRAINT withdrawal_requests_net_amount_check CHECK (net_amount > 0),
  CONSTRAINT withdrawal_requests_amounts_check CHECK (net_amount = requested_amount - commission_amount),
  CONSTRAINT withdrawal_requests_status_timestamps_check CHECK (
    (status = 'pending' AND approved_at IS NULL AND paid_at IS NULL AND rejected_at IS NULL)
    OR (status = 'approved' AND approved_at IS NOT NULL AND paid_at IS NULL AND rejected_at IS NULL)
    OR (status = 'paid' AND approved_at IS NOT NULL AND paid_at IS NOT NULL AND rejected_at IS NULL)
    OR (status = 'rejected' AND approved_at IS NULL AND paid_at IS NULL AND rejected_at IS NOT NULL)
  )
);

CREATE INDEX withdrawal_requests_writer_requested_at_idx
  ON withdrawal_requests (writer_user_id, requested_at DESC);
CREATE INDEX withdrawal_requests_status_requested_at_idx
  ON withdrawal_requests (status, requested_at DESC);

CREATE TABLE withdrawal_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_request_id UUID NOT NULL REFERENCES withdrawal_requests(id) ON DELETE CASCADE,
  from_status withdrawal_request_status,
  to_status withdrawal_request_status NOT NULL,
  note TEXT,
  actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX withdrawal_request_events_request_created_at_idx
  ON withdrawal_request_events (withdrawal_request_id, created_at DESC);

-- Source: 019_writer_bank_account_statuses.sql
ALTER TABLE writer_bank_accounts
  ADD COLUMN application_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';

ALTER TABLE writer_bank_accounts
  ADD CONSTRAINT writer_bank_accounts_application_status_check
    CHECK (application_status IN ('pending', 'approve', 'reject')),
  ADD CONSTRAINT writer_bank_accounts_status_check
    CHECK (status IN ('active', 'delete'));

-- Source: 022_seed_bank_logos.sql
INSERT INTO website_configs (key, value, description)
VALUES (
  'banks',
  '[
    {"code":"BBL","name":"ธนาคารกรุงเทพ","logo":"assets/banks/bbl.png"},
    {"code":"KBANK","name":"ธนาคารกสิกรไทย","logo":"assets/banks/kbank.png"},
    {"code":"KTB","name":"ธนาคารกรุงไทย","logo":"assets/banks/ktb.png"},
    {"code":"BAY","name":"ธนาคารกรุงศรีอยุธยา","logo":"assets/banks/bay.png"},
    {"code":"SCB","name":"ธนาคารไทยพาณิชย์","logo":"assets/banks/scb.png"},
    {"code":"TTB","name":"ธนาคารทหารไทยธนชาต","logo":"assets/banks/ttb.png"},
    {"code":"GSB","name":"ธนาคารออมสิน","logo":"assets/banks/gsb.png"},
    {"code":"BAAC","name":"ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร","logo":"assets/banks/baac.png"},
    {"code":"GHB","name":"ธนาคารอาคารสงเคราะห์","logo":"assets/banks/ghb.png"},
    {"code":"CIMBT","name":"ธนาคารซีไอเอ็มบี ไทย","logo":"assets/banks/cimbt.png"},
    {"code":"UOBT","name":"ธนาคารยูโอบี","logo":"assets/banks/uobt.png"},
    {"code":"KKP","name":"ธนาคารเกียรตินาคินภัทร","logo":"assets/banks/kkp.png"},
    {"code":"TISCO","name":"ธนาคารทิสโก้","logo":"assets/banks/tisco.png"}
  ]'::JSONB,
  'รายการธนาคารและโลโก้สำหรับบัญชีนักเขียน'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- Source: 023_notifications.sql
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

-- Source: 024_writer_application_reviews.sql
ALTER TABLE writer_bank_accounts
  ADD COLUMN reviewed_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN review_note TEXT;

ALTER TABLE writer_bank_accounts
  ADD CONSTRAINT writer_bank_accounts_application_review_check CHECK (
    (application_status = 'pending' AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL AND review_note IS NULL)
    OR (application_status = 'approve' AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
    OR (application_status = 'reject' AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND btrim(COALESCE(review_note, '')) <> '')
  );

-- Source: 025_writer_application_notifications.sql
ALTER TABLE notifications
  DROP CONSTRAINT notifications_type_check,
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'withdrawal_approved',
      'withdrawal_rejected',
      'writer_application_approved',
      'writer_application_rejected'
    )
  );

-- Source: 026_tts_agent_jobs.sql
CREATE TYPE tts_job_status AS ENUM ('queued', 'processing', 'done', 'failed', 'cancelled');

CREATE TABLE tts_agent_login_limits (
  key_hash CHAR(64) PRIMARY KEY,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tts_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_hash CHAR(64) NOT NULL,
  voice_slot VARCHAR(32) NOT NULL DEFAULT 'female'
    CHECK (voice_slot IN ('old_male', 'young_male', 'female')),
  status tts_job_status NOT NULL DEFAULT 'queued',
  worker_id UUID,
  lease_expires_at TIMESTAMPTZ,
  completed_blocks INTEGER NOT NULL DEFAULT 0 CHECK (completed_blocks >= 0),
  total_blocks INTEGER,
  audio_key TEXT,
  audio_url TEXT,
  duration_seconds NUMERIC(12, 3),
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tts_jobs_progress_check CHECK (total_blocks IS NULL OR completed_blocks <= total_blocks)
);

CREATE INDEX tts_jobs_writer_status_created_idx ON tts_jobs (requested_by, status, created_at DESC);
CREATE INDEX tts_jobs_processing_lease_idx ON tts_jobs (lease_expires_at) WHERE status = 'processing';
CREATE UNIQUE INDEX tts_jobs_one_active_render_idx
  ON tts_jobs (requested_by, chapter_id, source_hash, voice_slot)
  WHERE status IN ('queued', 'processing');

-- Source: 027_user_profiles.sql
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

INSERT INTO schema_migrations (version) VALUES ('001_initial_schema');

COMMIT;
