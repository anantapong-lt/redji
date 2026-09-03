-- =============================================================
-- Novel Platform — เพิ่ม action "ดูประวัติเติมเงินแบบเต็ม" เข้า permission matrix (2026-08-17)
-- =============================================================
-- เดิม level 8 เห็นประวัติเติมเงินแค่ 14 วันล่าสุด, level >= 9 เห็นเต็ม (ไม่จำกัดวัน) — ย้ายมาปรับ
-- ผ่านหน้าตั้งค่าได้เหมือน action อื่นๆ

INSERT INTO permission_actions (key, category, label, description, sort_order) VALUES
  ('moderation.topup_records.full_history', 'moderation', 'ดูประวัติเติมเงินย้อนหลังแบบเต็ม', 'ไม่จำกัดแค่ 14 วันล่าสุดเหมือน default', 12);

INSERT INTO permission_matrix (action_key, level, allowed)
SELECT 'moderation.topup_records.full_history', lvl, (lvl >= 9)
FROM unnest(ARRAY[8, 9, 10]) AS lvl;
