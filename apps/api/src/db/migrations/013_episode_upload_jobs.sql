-- Migration 013: "เพิ่มอัตโนมัติ" — bulk-upload หลายตอนพร้อมกันผ่าน zip
--
-- เก็บสถานะงาน background (ประมวลผลไฟล์ในzip ทีละไฟล์ ไม่บล็อก HTTP request) เพื่อให้
-- หน้าเว็บ poll เช็คความคืบหน้าได้ ("42/100") และรอดจาก server restart กลางทาง
-- (ไม่ใช้ BullMQ ตอนนี้ตามที่คุยกันไว้ — ตาราง job นี้พอสำหรับ scale ปัจจุบัน)
--
-- ทำต่อจนจบแม้บางไฟล์พัง (ไม่ all-or-nothing) — failed_files เก็บรายชื่อ+เหตุผลไฟล์
-- ที่ล้มเหลว ให้ frontend สรุปให้ user เห็นตอนจบ (เช่น "สำเร็จ 97/100 ล้มเหลว 3: ...")
CREATE TABLE IF NOT EXISTS episode_upload_jobs (
  id             BIGSERIAL PRIMARY KEY,
  p_id           BIGINT NOT NULL REFERENCES works(p_id),
  user_id        BIGINT NOT NULL REFERENCES users(id),
  status         TEXT NOT NULL DEFAULT 'processing'
                 CHECK (status IN ('processing', 'completed')),
  total          INTEGER NOT NULL,
  processed      INTEGER NOT NULL DEFAULT 0,
  failed_files   JSONB NOT NULL DEFAULT '[]',
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_episode_upload_jobs_p_id ON episode_upload_jobs(p_id);
