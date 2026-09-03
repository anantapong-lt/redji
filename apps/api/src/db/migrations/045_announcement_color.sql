-- Migration 045: สีพื้นหลังของประกาศ (announcements) — เดิมแถบประกาศหน้าเว็บ (AnnouncementBar,
-- 2026-08-11) ใช้สีเดียวตายตัว ผู้ใช้ขอให้แอดมินเลือกสีได้ตอนตั้งประกาศ — จำกัดเป็น preset
-- (ไม่ใช่ free-form hex) กันแอดมินเลือกสีที่กลืนพื้นหลัง/อ่านไม่ออกโดยไม่ตั้งใจ พรีเซ็ตที่ user
-- ขอ: เขียว/แดง/ม่วง/ทอง (ทอง = โทนตามสีรองของเว็บ) ฝั่ง frontend map key พวกนี้ไปเป็น gradient จริง
ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT 'gold'
  CHECK (color IN ('green', 'red', 'purple', 'gold'));
