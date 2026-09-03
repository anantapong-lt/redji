-- Migration 045: เพิ่ม succeeded_files ให้ episode_upload_jobs
--
-- เดิม job นี้เก็บแค่ failed_files (ไฟล์ที่ล้มเหลว) — ไม่มีบันทึกว่าไฟล์ไหนสำเร็จเป็นตอนอะไรบ้างเลย
-- ฝั่งหน้าเว็บเลยสรุปได้แค่ "สำเร็จ N/total" เป็นตัวเลขเฉยๆ ไม่มีรายละเอียดให้ดูทีละไฟล์
-- (2026-08-10 user ขอ — อยากได้หน้าต่างเลื่อนดูได้ว่าตอนไหนอัพสำเร็จ/ไม่สำเร็จบ้างหลังอัพเสร็จ)
ALTER TABLE episode_upload_jobs ADD COLUMN IF NOT EXISTS succeeded_files JSONB NOT NULL DEFAULT '[]';
