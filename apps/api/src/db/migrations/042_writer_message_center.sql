-- 042_writer_message_center.sql
-- 2026-08-08
--
-- ขยาย writer_admin_notices (migration 032) ให้เป็นกล่องรายงานจากแอดมิน
-- ที่รองรับข้อความถึงนักเขียนโดยตรงและเหตุการณ์ที่ระบบแจ้งแทนผู้ดูแล
-- โดยยังเก็บแถวเดิมที่ผูกกับผลงานไว้เหมือนเดิม

ALTER TABLE writer_admin_notices
  ALTER COLUMN work_id DROP NOT NULL,
  ALTER COLUMN admin_id DROP NOT NULL;

ALTER TABLE writer_admin_notices
  ADD COLUMN IF NOT EXISTS subject  TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS source   TEXT NOT NULL DEFAULT 'work_notice',
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE writer_admin_notices DROP CONSTRAINT IF EXISTS writer_admin_notices_severity_check;
ALTER TABLE writer_admin_notices
  ADD CONSTRAINT writer_admin_notices_severity_check
  CHECK (severity IN ('normal', 'risk', 'critical'));

ALTER TABLE writer_admin_notices DROP CONSTRAINT IF EXISTS writer_admin_notices_source_check;
ALTER TABLE writer_admin_notices
  ADD CONSTRAINT writer_admin_notices_source_check
  CHECK (source IN ('work_notice', 'admin_message', 'system_action'));

CREATE INDEX IF NOT EXISTS idx_writer_admin_notices_history
  ON writer_admin_notices(source, created_at DESC);
