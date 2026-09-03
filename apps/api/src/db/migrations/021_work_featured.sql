-- Migration 021: ย้าย "นิยายแนะนำ" จาก bookmark มาเป็นผลงานที่นักเขียนเผยแพร่เอง (2026-07-29)
--
-- migration 020 เข้าใจผิดว่า "นิยายแนะนำ"/"ทั้งหมด" ในหน้าโปรไฟล์หมายถึงนิยายที่ user
-- เก็บเข้าคลังไว้ (bookmark) — user แก้ให้ชัดว่าจริงๆ ต้องเป็นนิยายที่ตัวเอง (เจ้าของโปรไฟล์)
-- เขียน/เผยแพร่เอง ต่างหาก (เหมือนโปรไฟล์นักเขียนโชว์ผลงานตัวเอง ไม่ใช่โชว์ของที่ตัวเองอ่าน)
ALTER TABLE work_bookmarks DROP COLUMN IF EXISTS featured;
ALTER TABLE works ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;
