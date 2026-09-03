-- =============================================================
-- Novel Platform — เพิ่ม index รองรับกราฟ Analytics รวมทั้งเว็บ + สิทธิ์เข้าดู (2026-08-17)
-- =============================================================
-- เดิมตารางเหล่านี้ไม่มี index บนคอลัมน์วันที่เลย (ของเดิมมีแต่ query ที่กรองด้วย user_id/p_id
-- เจาะจงอยู่แล้ว เช่นกราฟยอดวิวรายนักเขียน) พอทำกราฟ "รวมทั้งเว็บ" (ไม่กรอง user/work คนเดียว)
-- ต้องมี index ตรงนี้ก่อน ไม่งั้นข้อมูลเยอะขึ้นจะ scan ทั้งตารางทุกครั้ง

CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_works_created_at ON works(created_at);
CREATE INDEX IF NOT EXISTS idx_ep_shop_created_at ON ep_shop(created_at);
CREATE INDEX IF NOT EXISTS idx_topup_transactions_status_created_at ON topup_transactions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status_created_at ON withdrawals(status, created_at);
CREATE INDEX IF NOT EXISTS idx_user_bans_created_at ON user_bans(created_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_suspensions_created_at ON user_activity_suspensions(created_at);
CREATE INDEX IF NOT EXISTS idx_user_spend_suspensions_created_at ON user_spend_suspensions(created_at);

-- ---- สิทธิ์เข้าดูหน้า Analytic ----
-- system.analytics.view = ภาพรวมเว็บ/นักอ่าน/การควบคุมเนื้อหา (default level >= 9 เหมือน content.* อื่น)
-- system.analytics_finance.view = กราฟการเงินโดยเฉพาะ (default level 10 เท่านั้น ตามที่ user ยืนยัน —
-- level 9 จะไม่เห็นส่วนนี้เลย จนกว่า level 10 จะเข้าไปเปิดสิทธิ์ให้เองในหน้าตั้งค่า)
INSERT INTO permission_actions (key, category, label, description, sort_order) VALUES
  ('system.analytics.view',         'system', 'ดูภาพรวม Analytics',        'ภาพรวมเว็บ/นักอ่าน/การควบคุมเนื้อหา', 3),
  ('system.analytics_finance.view', 'system', 'ดู Analytics ด้านการเงิน', 'กราฟรายได้/ยอดขาย/ถอนเงิน — ข้อมูลอ่อนไหว', 4);

INSERT INTO permission_matrix (action_key, level, allowed)
SELECT 'system.analytics.view', lvl, (lvl >= 9) FROM unnest(ARRAY[8, 9, 10]) AS lvl;

INSERT INTO permission_matrix (action_key, level, allowed)
SELECT 'system.analytics_finance.view', lvl, (lvl >= 10) FROM unnest(ARRAY[8, 9, 10]) AS lvl;
