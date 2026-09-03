-- Migration 019: หลายช่องทางโซเชียล (สูงสุด 4) + ตัด location ทิ้ง
--
-- user ขอ 2 อย่าง: (1) เก็บ "ช่องทาง" ได้หลายอันแบบ YouTube Studio (ไม่ใช่แค่ website เดียว
-- ใน social_media JSONB แบบเดิม) (2) ตัดฟิลด์ "สถานที่" (location, migration 018) ทิ้งไปเลย
--
-- ตาราง user_social_links แยกออกมาแทน social_media.website/website_label เดิม (ยังคง
-- social_media ไว้เผื่อ facebook/twitter/instagram ในอนาคต แต่ website ย้ายมาที่นี่แทน
-- เพราะต้องรองรับหลายอันต่อ user ซึ่ง JSONB key เดียวทำไม่ได้)

CREATE TABLE IF NOT EXISTS user_social_links (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  label      TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_social_links_user_id ON user_social_links(user_id);

-- ย้ายข้อมูล website/website_label เดิม (ถ้ามี) เข้าตารางใหม่ ไม่ให้ข้อมูลที่เคยตั้งไว้หายไป
INSERT INTO user_social_links (user_id, url, label, sort_order)
SELECT id, social_media->>'website', social_media->>'website_label', 0
FROM users
WHERE social_media->>'website' IS NOT NULL;

ALTER TABLE users DROP COLUMN IF EXISTS location;
