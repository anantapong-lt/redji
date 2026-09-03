-- Migration 016: เพิ่มสถานะ 'failed' ให้ episode_upload_jobs
--
-- เดิม CHECK constraint อนุญาตแค่ 'processing'/'completed' — ถ้า processEntries() (bulk-upload
-- service) throw นอก per-file try/catch (เช่น query แรกสุดพัง หรือเขียน progress ไม่ผ่าน)
-- job จะค้างสถานะ 'processing' ตลอดไป ไม่มีทางบอกว่าล้มเหลว ฝั่งหน้าเว็บ poll ไม่รู้จบเลย
-- (ดู KNOWN_ISSUES.md) — เพิ่ม 'failed' + คอลัมน์ error_message เก็บเหตุผลไว้ debug
ALTER TABLE episode_upload_jobs DROP CONSTRAINT IF EXISTS episode_upload_jobs_status_check;
ALTER TABLE episode_upload_jobs ADD CONSTRAINT episode_upload_jobs_status_check
  CHECK (status IN ('processing', 'completed', 'failed'));

ALTER TABLE episode_upload_jobs ADD COLUMN IF NOT EXISTS error_message TEXT;
