-- =============================================================
-- Novel Platform — Migration 004: Editor fields (age_rate, is_translated, tags)
-- รันหลัง 003_referral.sql
-- Idempotent: เช็คก่อนทุกจุด รันซ้ำกับ DB ที่ migrate ไปแล้วได้อย่างปลอดภัย
-- =============================================================

-- ---- age_rate: ลดจาก 4 ระดับ (all,13+,16+,18+) เหลือ 2 ระดับ (all,18+) ----
-- ตาม UI จริงของหน้า "เพิ่มนิยายใหม่" ที่เป็น switch เดียว (18+ เปิด/ปิด)
-- migrate ของเก่า: 13+/16+ → all (ยังไม่มี record จริงตอนเขียน migration นี้)
UPDATE works SET age_rate = 'all' WHERE age_rate IN ('13+', '16+');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cartoons_age_rate_check'
  ) THEN
    ALTER TABLE works DROP CONSTRAINT cartoons_age_rate_check;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'works_age_rate_check'
  ) THEN
    ALTER TABLE works ADD CONSTRAINT works_age_rate_check
      CHECK (age_rate = ANY (ARRAY['all', '18+']));
  END IF;
END $$;

-- ---- is_translated: แยกจาก origin_type (สัญชาติ) — คนละมิติกัน ----
-- "ประเภทนิยาย" ในหน้า Editor: นิยายแปล (true) / แต่งเอง (false)
ALTER TABLE works ADD COLUMN IF NOT EXISTS is_translated BOOLEAN NOT NULL DEFAULT false;

-- ---- tags: หมวดหมู่เสริม แบบพิมพ์ใส่ Tag อิสระ (ไม่ผูกกับตาราง categories) ----
-- ตัดสินใจแล้วว่าให้สร้าง tag ใหม่ได้เลย ไม่บังคับว่าต้องมีอยู่ใน DB ก่อน (ง่ายและเร็วกว่า
-- ระบบ autocomplete เต็มรูปแบบ — ถ้า tag ขยะเยอะขึ้นค่อยพิจารณา normalize/limit ทีหลัง)
ALTER TABLE works ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

-- ---- original_title: ช่อง "ชื่อเรื่องต้นฉบับ" ในหน้า Editor ไม่มีที่เก็บมาก่อนเลย ----
ALTER TABLE works ADD COLUMN IF NOT EXISTS original_title TEXT;
