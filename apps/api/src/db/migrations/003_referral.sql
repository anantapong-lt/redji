-- =============================================================
-- Novel Platform — Migration 003: Referral System
-- รันหลัง 002_novel_blocks.sql
-- Idempotent: เช็คก่อนทุกจุด รันซ้ำกับ DB ที่ migrate ไปแล้วได้อย่างปลอดภัย
-- (เขียนย้อนหลังให้ตรงกับ schema จริงที่ novelnova_db มีอยู่แล้ว)
-- =============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS referral_code   TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by     BIGINT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS writer_tier     TEXT NOT NULL DEFAULT 'standard' CHECK (writer_tier IN ('pioneer','standard')),
  ADD COLUMN IF NOT EXISTS withdrawal_rate NUMERIC(5,4);  -- null = ใช้ WITHDRAWAL_RATE จาก .env

CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by   ON users(referred_by);

-- ---- REFERRAL_CODE_REQUESTS ----
-- writer ขอ custom referral code → admin approve/reject
CREATE TABLE IF NOT EXISTS referral_code_requests (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id),
  requested     TEXT NOT NULL,              -- code ที่อยากได้ (a-z, 0-9, 4-20 ตัว)
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by   BIGINT REFERENCES users(id),
  reject_reason TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ---- WRITER_REFERRAL_LINKS ----
-- ความสัมพันธ์ writer A ชวน writer B มาเป็นนักเขียน
-- referrer_id = A (คนชวน, ได้รับ bonus_rate), writer_id = B (คนถูกชวน)
CREATE TABLE IF NOT EXISTS writer_referral_links (
  id          BIGSERIAL PRIMARY KEY,
  referrer_id BIGINT NOT NULL REFERENCES users(id),
  writer_id   BIGINT NOT NULL REFERENCES users(id),
  bonus_rate  NUMERIC(5,4) NOT NULL DEFAULT 0.01,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referrer_id, writer_id)
);

CREATE INDEX IF NOT EXISTS idx_writer_referral_referrer ON writer_referral_links(referrer_id);
CREATE INDEX IF NOT EXISTS idx_writer_referral_writer   ON writer_referral_links(writer_id);
