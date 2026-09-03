-- Migration 044: "เพิ่มนิยายหลายเรื่อง" — แอดมินอัพนิยายเป็นก้อนใหญ่แทนบัญชี "นักเขียนของเว็บ"
-- (level 7 — บัญชีผีที่บริษัทคุมเอง ใช้ปั้นเนื้อหา/ย้ายข้อมูลก้อนใหญ่ มติ 2026-08-10)
--
-- โครงสร้าง zip: โฟลเดอร์ระดับบนสุด = 1 นิยาย/โฟลเดอร์ ข้างในมีไฟล์ตอน (.txt/.docx ชื่อไฟล์แบบ
-- เดียวกับ "เพิ่มอัตโนมัติ" ของนักเขียน — ดู writer.bulk-upload.service.ts) + รูปปก 1 ไฟล์
-- (ระบบเดารูปปกจากนามสกุลไฟล์รูปในโฟลเดอร์เอง) รองรับ ~100 นิยายต่อ zip เดียว
--
-- คนละตารางกับ episode_upload_jobs เพราะหน่วยความคืบหน้าไม่เหมือนกัน (นับ "นิยาย" ทั้งเรื่อง
-- ไม่ใช่ "ไฟล์ตอน" ในนิยายเรื่องเดียว) — เก็บ error_message + status 'failed' มาตั้งแต่ต้นเลย
-- (เรียนรู้จากบั๊กจริงที่เจอกับ episode_upload_jobs เดิม — ดู migration 016 — ที่ไม่ทำแบบนี้ตั้งแต่
-- แรกแล้วต้องมาแก้ทีหลัง)
CREATE TABLE IF NOT EXISTS admin_novel_upload_jobs (
  id              BIGSERIAL PRIMARY KEY,
  admin_id        BIGINT NOT NULL REFERENCES users(id),   -- แอดมินที่สั่งอัพ (audit)
  target_user_id  BIGINT NOT NULL REFERENCES users(id),   -- บัญชี "นักเขียนของเว็บ" ที่นิยายจะไปอยู่ใต้
  status          TEXT NOT NULL DEFAULT 'processing'
                  CHECK (status IN ('processing', 'completed', 'failed')),
  total           INTEGER NOT NULL,
  processed       INTEGER NOT NULL DEFAULT 0,
  failed_items    JSONB NOT NULL DEFAULT '[]',   -- [{folder_name, reason}]
  created_works   JSONB NOT NULL DEFAULT '[]',   -- [{uuid, title}] — นิยายที่สร้างสำเร็จ ให้ frontend สรุปผลตอนจบ
  error_message   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_novel_upload_jobs_target_user_id ON admin_novel_upload_jobs(target_user_id);
