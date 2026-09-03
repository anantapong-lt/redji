-- 032_writer_reports_and_notices.sql
-- 2026-08-06
--
-- 1. content_reports (migration 025) เดิมไม่มีหมวดหมู่เลย (แค่ reason ข้อความเปล่า) — user ขอให้
--    เพิ่มหมวดหมู่แบบเลือกได้ (dropdown) โดยหมวด "รายงานความผิดพลาด (สะกดผิด, เขียนผิด, แท็กผิด)"
--    ต้องเด้งเข้าหานักเขียนเจ้าของผลงานแทนที่จะเข้าคิวแอดมินเหมือนหมวดอื่นๆ ทั้งหมด — เพิ่ม
--    work_author_id (snapshot ตอนสร้างรายงาน ใช้ query ฝั่งนักเขียนได้ตรงๆ ไม่ต้อง join สด) และ
--    writer_note/writer_acknowledged_at (นักเขียนตอบกลับสั้นๆ เป็นหมายเหตุ ให้แอดมินเห็นในคิวเดิม
--    ด้วย — ไม่ใช่ระบบแจ้งเตือนใหม่ อาศัยหน้ารายงานของแอดมินที่มีอยู่แล้วแสดงเพิ่ม)
--
--    ไม่ backfill category ให้แถวเก่า (ปล่อย NULL ไว้ — รายงานเก่าไม่เคยมีหมวดหมู่มาก่อนจริงๆ
--    ไม่ใช่ข้อมูลหาย) แอดมินยังเห็นแถวเก่าในคิวปกติ แค่ไม่มี label หมวดหมู่โชว์
--
-- 2. writer_admin_notices — ตารางใหม่ทั้งหมด: แอดมินส่ง "รายงาน/แจ้งเตือน" ถึงนักเขียนเจ้าของ
--    ผลงานเรื่องใดเรื่องหนึ่งโดยตรง (ส่งจากหน้าจัดการผลงานเรื่องนั้นในฝั่งแอดมิน) — คนละเรื่องกับ
--    content_reports ที่มาจากนักอ่าน นักเขียนเห็นเป็นอีกแท็บ ("รายงานจากแอดมิน") ตอบกลับสั้นๆ ได้
--    เหมือนกัน ไม่เคยมี concept นี้มาก่อนในระบบ (เช็คแล้วก่อนเขียน migration นี้)

ALTER TABLE content_reports
  ADD COLUMN IF NOT EXISTS category                TEXT,
  ADD COLUMN IF NOT EXISTS work_author_id           BIGINT REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS writer_note              TEXT,
  ADD COLUMN IF NOT EXISTS writer_acknowledged_at   TIMESTAMPTZ;

ALTER TABLE content_reports DROP CONSTRAINT IF EXISTS content_reports_category_check;
ALTER TABLE content_reports
  ADD CONSTRAINT content_reports_category_check CHECK (
    category IS NULL OR category IN (
      'content_error', 'copyright', 'unrated_18plus', 'inappropriate',
      'scam', 'spam', 'impersonation', 'general', 'other'
    )
  );

CREATE INDEX IF NOT EXISTS idx_content_reports_writer
  ON content_reports(work_author_id, category, created_at DESC)
  WHERE work_author_id IS NOT NULL;

-- ---- WRITER_ADMIN_NOTICES ----
CREATE TABLE IF NOT EXISTS writer_admin_notices (
  id                      BIGSERIAL PRIMARY KEY,
  work_id                 BIGINT NOT NULL REFERENCES works(p_id),
  writer_id               BIGINT NOT NULL REFERENCES users(id),  -- snapshot จาก works.author_id ตอนสร้าง
  admin_id                BIGINT NOT NULL REFERENCES users(id),
  message                 TEXT NOT NULL,
  writer_note             TEXT,
  writer_acknowledged_at  TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_writer_admin_notices_writer
  ON writer_admin_notices(writer_id, created_at DESC);
