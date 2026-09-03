-- Migration 022: แท็บ "แนะนำ"/"ทั้งหมด" หน้าโปรไฟล์สำหรับนักอ่านทั่วไป (2026-07-29)
--
-- migration 021 ย้ายกล่องผลงานไปเป็น "ผลงานที่เผยแพร่เอง" ทั้งหมด — แต่ใช้ได้แค่นักเขียน
-- (level >= 6) เท่านั้น โปรไฟล์นักอ่านทั่วไปไม่มีผลงานให้โชว์เลย — user ขอให้นักอ่านทั่วไปใช้
-- "บุ๊คมาร์ค" (นิยายที่เก็บเข้าคลังไว้) แทน พร้อม toggle ให้ซ่อนจากคนอื่นได้ (default โชว์)
ALTER TABLE work_bookmarks ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bookmarks_public BOOLEAN NOT NULL DEFAULT true;
