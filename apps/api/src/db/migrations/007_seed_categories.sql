-- Migration 007: seed categories ให้ตรงกับ MOCK_CATEGORIES ฝั่ง frontend
-- (apps/web/src/lib/mock-categories.ts) — ตาราง categories ว่างเปล่ามาตลอด ทำให้
-- เลือกหมวดหมู่แล้วบันทึกนิยาย ชน foreign key constraint ทุกครั้ง (category_main/
-- category_sub อ้างอิง id ที่ไม่มีจริง) ใส่ id ตรงๆ ให้ตรงกับ mock เพื่อไม่ต้องแก้ frontend
INSERT INTO categories (id, name, status) VALUES
  (1,  'รักโรแมนติก',    true),
  (2,  'แฟนตาซี',        true),
  (3,  'ดราม่า',          true),
  (4,  'ผจญภัย',          true),
  (5,  'ตลก',             true),
  (6,  'สยองขวัญ',        true),
  (7,  'แอ็คชั่น',         true),
  (8,  'ไซไฟ',            true),
  (9,  'ลึกลับ',           true),
  (10, 'ประวัติศาสตร์',    true),
  (11, 'ยูริ',             true),
  (12, 'ยาโอย',            true)
ON CONFLICT (id) DO NOTHING;

-- กัน sequence ชนกับ id ที่ใส่ตรงๆ ไว้ตอน insert ครั้งต่อไป
SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));
