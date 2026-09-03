-- 029_special_categories.sql
-- 2026-08-05
--
-- "หมวดหมู่ย่อยแบบพิเศษ" — วาย (เดิมชื่อยาโอย) / ยูริ / 18+ ย้ายออกจากระบบ category_main/
-- category_sub ธรรมดา (FK ไปตาราง categories แบบเรียบ ไม่มีคอลัมน์สี) มาเป็น boolean flag
-- ตรงบน works แทน เพราะต้องมีสีเฉพาะตัว + badge พิเศษ (วงกลม M/Y/U มุมการ์ด, tag สีเฉพาะโผล่
-- หน้าสุด) ซึ่งระบบ category เดิมไม่รองรับเลย (categories ไม่มีคอลัมน์ color — ดู 001_init.sql/
-- 007_seed_categories.sql) — 18+ เดิมมี works.age_rate อยู่แล้ว ไม่ต้องเพิ่มคอลัมน์ใหม่
--
-- ยูริ = category id 11, ยาโอย = category id 12 (007_seed_categories.sql) — เปลี่ยนชื่อ "ยาโอย"
-- เป็น "วาย" ตามที่ user สั่ง แล้วปิด (status=false) ทั้งคู่กันไม่ให้โผล่เป็นตัวเลือก category
-- ปกติอีกต่อไป (getCategories() กรอง status=true อยู่แล้ว) แต่ไม่ DELETE row เพราะยังมีงานเก่าที่
-- อาจอ้างอิง id นี้อยู่ผ่าน FK — เก็บไว้เพื่อความสมบูรณ์ของข้อมูลอ้างอิงเหมือน pattern อื่นในโปรเจกต์

ALTER TABLE works
  ADD COLUMN IF NOT EXISTS is_yaoi BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_yuri BOOLEAN NOT NULL DEFAULT false;

-- ---- Backfill งานเก่าที่เคยเลือก ยูริ/ยาโอย ผ่าน category_main หรือ category_sub ----
UPDATE works SET is_yuri = true, category_main = NULL WHERE category_main = 11;
UPDATE works SET is_yuri = true, category_sub  = NULL WHERE category_sub  = 11;
UPDATE works SET is_yaoi = true, category_main = NULL WHERE category_main = 12;
UPDATE works SET is_yaoi = true, category_sub  = NULL WHERE category_sub  = 12;

-- ---- เปลี่ยนชื่อ + ปิดใช้งาน 2 แถวนี้ใน categories (ไม่ลบ กัน FK เก่าพัง) ----
UPDATE categories SET name = 'วาย', status = false WHERE id = 12;
UPDATE categories SET status = false WHERE id = 11;
