-- =============================================================
-- Novel Platform — เปิดให้ level 8 เข้าดู Analytic ได้ (2026-08-18)
-- =============================================================
-- เดิม system.analytics.view (ภาพรวมเว็บ/นักอ่าน/การควบคุมเนื้อหา) default level >= 9 เท่านั้น
-- (migration 051) — user ขอให้ level 8 เข้าได้ด้วย แต่ยังไม่เห็นหมวดการเงิน (system.
-- analytics_finance.view ยังคง default level 10 เท่านั้นเหมือนเดิม ไม่แตะ — level 8 กับ 9 เลย
-- ไม่เห็นหมวดนี้เหมือนกันทั้งคู่ จนกว่า level 10 จะเข้าไปเปิดสิทธิ์ให้เองในหน้าตั้งค่า)

UPDATE permission_matrix SET allowed = true, updated_at = now()
WHERE action_key = 'system.analytics.view' AND level = 8;
