-- 027_admin_user_management.sql
-- 2026-07-30
--
-- Schema สำหรับหน้า "จัดการผู้ใช้" เวอร์ชันเต็มใน apps/admin (ข้อ 2 ของสเปคที่ user ไล่เรียงมา):
-- 1. เครื่องมือ 4 อย่างที่ "ซ้อนกันได้พร้อมกัน" ตามที่ตกลง (ระงับการเคลื่อนไหว/ระงับใช้จ่าย+เติมเงิน
--    เป็นตารางแยกแบบเดียวกับ user_bans ที่มีอยู่แล้ว — lifted_at/unbanned_at เป็น null = active
--    ส่วนแบนใช้ user_bans เดิม ไม่สร้างซ้ำ)
-- 2. ลบบัญชีถาวร — เป็นคอลัมน์บน users โดยตรง (สถานะทางเดียว ไม่มี "ยกเลิกการลบ")
--    ⚠️ ตัดสินใจเอง: "ลบถาวร" ในนี้คือ anonymize (เคลียร์ email/password/ข้อมูลส่วนตัว + ตั้ง
--    deleted_at) ไม่ใช่ DELETE row จริง — เพราะ users ถูกอ้างอิงจาก FK เต็มไปหมด (comments, works,
--    coin_ledger, ฯลฯ) DELETE จริงจะพังทันทีที่มีข้อมูลเกี่ยวข้องอยู่ (ซึ่งมีแน่นอนสำหรับ user ที่
--    active ไปแล้ว) เป็น pattern มาตรฐานของการทำ "right to be forgotten" ด้วย (เก็บ row ไว้เพื่อ
--    ความสมบูรณ์ของข้อมูลอ้างอิง แต่ลบตัวตนที่ระบุได้ออก)
-- 3. ระบบ Flag ของ level 8 — ต้องมีคนหลายคน flag เรื่องเดียวกันในเป้าหมายเดียวกันครบเกณฑ์ถึงจะ
--    auto-execute ได้ (level 9 ขึ้นไป execute เองได้ทันทีไม่ต้องรอ) เกณฑ์ตั้งได้ผ่าน web_setting

-- ---- ระงับการเคลื่อนไหว (บล็อกทำอะไรไม่ได้เลย) ----
CREATE TABLE IF NOT EXISTS user_activity_suspensions (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id),
  reason       TEXT NOT NULL,
  suspended_by BIGINT NOT NULL REFERENCES users(id),
  lifted_at    TIMESTAMPTZ,                      -- null = ยังระงับอยู่
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_activity_suspensions_active
  ON user_activity_suspensions(user_id) WHERE lifted_at IS NULL;

-- ---- ระงับการใช้จ่าย+เติมเงิน (กันบอทปั่นเว็บล้มละลาย) ----
CREATE TABLE IF NOT EXISTS user_spend_suspensions (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT NOT NULL REFERENCES users(id),
  reason       TEXT NOT NULL,
  suspended_by BIGINT NOT NULL REFERENCES users(id),
  lifted_at    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_spend_suspensions_active
  ON user_spend_suspensions(user_id) WHERE lifted_at IS NULL;

-- ---- ลบบัญชีถาวร (anonymize) ----
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by       BIGINT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS deletion_reason  TEXT;

-- ---- ระบบ Flag (level 8 flag → นับ consensus → auto-execute ถ้าครบเกณฑ์) ----
CREATE TABLE IF NOT EXISTS admin_user_flags (
  id              BIGSERIAL PRIMARY KEY,
  target_user_id  BIGINT NOT NULL REFERENCES users(id),
  action_type     TEXT NOT NULL CHECK (action_type IN ('suspend_activity', 'suspend_spending', 'ban', 'delete')),
  flagged_by      BIGINT NOT NULL REFERENCES users(id),
  reason          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'auto_executed', 'executed', 'dismissed')),
  reviewed_by     BIGINT REFERENCES users(id),      -- ใครกด execute/dismiss (null ถ้า auto_executed)
  review_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_admin_user_flags_target
  ON admin_user_flags(target_user_id, action_type, status);

-- กันคนเดิม flag เป้าหมาย+action เดิมซ้ำระหว่างที่ยัง pending (เหมือน content_reports) — ไม่งั้น
-- คนเดียวส่ง flag รัวๆ ปั้นยอดให้ครบเกณฑ์คนเดียวได้ ทำลายจุดประสงค์ของระบบ consensus ทั้งหมด
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_user_flags_one_pending_per_flagger
  ON admin_user_flags(target_user_id, action_type, flagged_by) WHERE status = 'pending';

-- ---- ค่าตั้งต้นของระบบ threshold (แก้ได้ผ่าน PATCH /admin/settings, level 10 เท่านั้น) ----
INSERT INTO web_setting (key, value) VALUES
  ('flag_auto_execute_enabled', 'true'),
  ('flag_threshold_count',      '3'),
  ('flag_window_hours',         '48')
ON CONFLICT (key) DO NOTHING;
