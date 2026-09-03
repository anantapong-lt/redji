-- =============================================================
-- Novel Platform — เปิดให้จัดการหมวดหมู่นิยายผ่านหน้าแอดมิน (2026-08-17)
-- =============================================================
-- เดิม categories ต้องแก้ผ่าน SQL migration ตรงๆ เท่านั้น (ไม่มี CRUD endpoint เลย) — เพิ่ม
-- คอลัมน์ icon (emoji ที่โชว์บนแถบหมวดหมู่หน้าแรก — คนละอันกับ Carousel แบนเนอร์รูปภาพ)
-- เพื่อเลิกพึ่งการ map ชื่อ → emoji แบบ hardcode
-- ที่ apps/web/src/components/home/category-row.tsx (เปลี่ยนชื่อหมวดแล้วไอคอนไม่หลุดกลับไปเป็น
-- ไอคอนทั่วไปเหมือนเดิมอีกต่อไป)

ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon TEXT;

-- backfill ให้ตรงกับ CATEGORY_ICONS เดิมเป๊ะ (ก่อนหน้านี้ hardcode อยู่ใน category-row.tsx)
-- กันไม่ให้หน้าแรกเปลี่ยนหน้าตาไปเลยตอน deploy ครั้งนี้
UPDATE categories SET icon = '💕' WHERE name = 'รักโรแมนติก';
UPDATE categories SET icon = '✨' WHERE name = 'แฟนตาซี';
UPDATE categories SET icon = '🎭' WHERE name = 'ดราม่า';
UPDATE categories SET icon = '🗺️' WHERE name = 'ผจญภัย';
UPDATE categories SET icon = '😂' WHERE name = 'ตลก';
UPDATE categories SET icon = '👻' WHERE name = 'สยองขวัญ';
UPDATE categories SET icon = '⚡' WHERE name = 'แอ็คชั่น';
UPDATE categories SET icon = '🚀' WHERE name = 'ไซไฟ';
UPDATE categories SET icon = '🔍' WHERE name = 'ลึกลับ';
UPDATE categories SET icon = '📜' WHERE name = 'ประวัติศาสตร์';
UPDATE categories SET icon = '🌸' WHERE name = 'ยูริ';
UPDATE categories SET icon = '🌈' WHERE name = 'ยาโอย';
-- แถวที่เหลือ (รวม ยูริ/BL เดิมที่ถูกเปลี่ยนชื่อ+ปิดไปแล้วใน migration 029/030) fallback เป็น 📚
UPDATE categories SET icon = '📚' WHERE icon IS NULL;

-- เพิ่ม action สิทธิ์ใหม่เข้า permission matrix (migration 047) — default level >= 9 เหมือน
-- action หมวด content อื่นๆ ทั้งหมด
INSERT INTO permission_actions (key, category, label, description, sort_order) VALUES
  ('content.categories.manage', 'content', 'จัดการหมวดหมู่นิยาย', 'เพิ่ม/แก้ชื่อ-ไอคอน/เปิดปิดการมองเห็น/ลบหมวดหมู่', 8);

INSERT INTO permission_matrix (action_key, level, allowed)
SELECT 'content.categories.manage', lvl, (lvl >= 9)
FROM unnest(ARRAY[8, 9, 10]) AS lvl;
