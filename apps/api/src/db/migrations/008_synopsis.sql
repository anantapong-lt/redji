-- Migration 008: "เรื่องย่อ" (rich text ยาว, แยกจาก "คำโปรย"/description)
-- เก็บเป็น JSONB (Tiptap document JSON) ไม่ใช่ HTML ดิบ เพื่อเลี่ยง XSS ตอน render ทีหลัง
ALTER TABLE works ADD COLUMN IF NOT EXISTS synopsis JSONB;
