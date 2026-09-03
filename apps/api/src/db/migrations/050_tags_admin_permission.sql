-- =============================================================
-- Novel Platform — เพิ่ม action จัดการ "หมวดหมู่ย่อย" (tags) เข้า permission matrix (2026-08-17)
-- =============================================================
-- เดิม tags ไม่มีหน้าแอดมินจัดการเลย (แก้ได้แค่ผ่านฟอร์มเขียนนิยายทีละเรื่อง) — เพิ่มหน้า
-- "ตั้งหน้าเว็บไซต์ > หมวดหมู่ย่อย" ให้ดู/ลบ/ถอด tag ได้ตรงๆ default level >= 9 เหมือน content.* อื่น

INSERT INTO permission_actions (key, category, label, description, sort_order) VALUES
  ('content.tags.manage', 'content', 'จัดการหมวดหมู่ย่อย (tag)', 'ดูรายการ/ถอด/ลบ tag เสริมที่นักเขียนใส่ในนิยาย', 9);

INSERT INTO permission_matrix (action_key, level, allowed)
SELECT 'content.tags.manage', lvl, (lvl >= 9)
FROM unnest(ARRAY[8, 9, 10]) AS lvl;
