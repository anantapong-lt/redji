-- =============================================================
-- Novel Platform — Migration 002: Novel Blocks + work/* renames
-- รันหลัง 001_init.sql
-- Idempotent: เช็คก่อนทุกจุด รันซ้ำกับ DB ที่ migrate ไปแล้วได้อย่างปลอดภัย
-- (เขียนย้อนหลังให้ตรงกับ schema จริงที่ novelnova_db มีอยู่แล้ว)
-- =============================================================

-- ---- Renames: cartoons-family → work-family ----

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cartoons') THEN
    ALTER TABLE cartoons RENAME TO works;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'manga_ep') THEN
    ALTER TABLE manga_ep RENAME TO work_ep;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'manga_ep_images') THEN
    ALTER TABLE manga_ep_images RENAME TO cartoon_ep_image;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'manga_ep_views') THEN
    ALTER TABLE manga_ep_views RENAME TO work_ep_views;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'manga_favorite') THEN
    ALTER TABLE manga_favorite RENAME TO work_favorite;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cartoon_comments') THEN
    ALTER TABLE cartoon_comments RENAME TO work_comments;
    ALTER TABLE work_comments RENAME COLUMN cartoon_id TO work_id;
  END IF;
END $$;

-- ---- ep_content: TEXT (raw string) → JSONB (NovelBlock[]) ----
-- ทำไม: นิยายต้องเก็บเป็น array ของ block (ดู NovelBlock ใน db/types.ts)
-- เพื่อรองรับ styling ต่อ block และ TTS timestamp ในอนาคต
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'work_ep' AND column_name = 'ep_content' AND data_type = 'text'
  ) THEN
    ALTER TABLE work_ep ALTER COLUMN ep_content TYPE JSONB USING
      CASE WHEN ep_content IS NULL OR ep_content = '' THEN NULL ELSE ep_content::jsonb END;
  END IF;
END $$;

-- ---- NOVEL_BLOCK_REPORTS ----
-- user รายงานว่า block ไหนใน episode มีข้อผิดพลาด (พิมพ์ผิด, แปลผิด ฯลฯ)
CREATE TABLE IF NOT EXISTS novel_block_reports (
  id         BIGSERIAL PRIMARY KEY,
  ep_id      BIGINT NOT NULL REFERENCES work_ep(ep_id) ON DELETE CASCADE,
  block_id   TEXT NOT NULL,                     -- อ้างอิง NovelBlock.id เช่น "block_3"
  user_id    BIGINT NOT NULL REFERENCES users(id),
  reason     TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','resolved','dismissed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---- PASSWORD_RESET_TOKENS ----
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id),
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens(token);
