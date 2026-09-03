-- 024_admin_permissions_and_writer_detail.sql
-- 2026-07-30
--
-- 1. ขยาย user_detail ให้ตรงกับฟอร์ม /writer/info จริง (เดิมมีแค่ prefix/name/phone/bank
--    ไม่มีเลขบัตรประชาชน/ที่อยู่เลย) — เพื่อให้ต่อ backend จริงได้ (เดิมฟอร์มนี้ mock อยู่ฝั่ง client
--    ล้วนๆ ผ่าน writer-application.store.ts)
-- 2. เพิ่มตาราง admin_action_requests รองรับ 2 ระบบอนุมัติ:
--      ban_user         — level 8 ส่งคำขอ, level >= 9 อนุมัติ
--      promote_level_8  — level 9 ส่งคำขอ, level >= 10 อนุมัติ

ALTER TABLE user_detail
  ADD COLUMN IF NOT EXISTS national_id          TEXT,
  ADD COLUMN IF NOT EXISTS id_address           TEXT,
  ADD COLUMN IF NOT EXISTS id_province          TEXT,
  ADD COLUMN IF NOT EXISTS id_district          TEXT,
  ADD COLUMN IF NOT EXISTS id_subdistrict       TEXT,
  ADD COLUMN IF NOT EXISTS id_postal_code       TEXT,
  ADD COLUMN IF NOT EXISTS current_address      TEXT,
  ADD COLUMN IF NOT EXISTS current_province     TEXT,
  ADD COLUMN IF NOT EXISTS current_district     TEXT,
  ADD COLUMN IF NOT EXISTS current_subdistrict  TEXT,
  ADD COLUMN IF NOT EXISTS current_postal_code  TEXT,
  ADD COLUMN IF NOT EXISTS bank_branch          TEXT;

-- fan_page_link ไม่เคยถูกเก็บจากฟอร์มจริงเลยสักครั้ง (ฟอร์ม /writer/info ไม่มีช่องนี้อยู่แล้ว)
-- เดิม NOT NULL จะบล็อกการ submit จริงทุกครั้ง — ผ่อนเป็น nullable
ALTER TABLE user_detail ALTER COLUMN fan_page_link DROP NOT NULL;

-- กันคนส่งคำขอซ้ำหลายใบพร้อมกัน (1 user มีคำขอ pending ได้แค่ใบเดียว)
CREATE UNIQUE INDEX IF NOT EXISTS user_detail_one_pending_per_user
  ON user_detail(user_id) WHERE status = 'pending';

-- ============================================================
-- Admin action requests
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_action_requests (
  id              BIGSERIAL PRIMARY KEY,
  request_type    TEXT NOT NULL CHECK (request_type IN ('ban_user', 'promote_level_8')),
  requested_by    BIGINT NOT NULL REFERENCES users(id),
  target_user_id  BIGINT NOT NULL REFERENCES users(id),
  reason          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by     BIGINT REFERENCES users(id),
  review_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_action_requests_status
  ON admin_action_requests(request_type, status);
