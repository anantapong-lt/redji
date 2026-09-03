-- Migration 020: "นิยายแนะนำ" ในกล่องเก็บนิยายหน้าโปรไฟล์ (2026-07-29)
--
-- user ขอแยกกล่อง "นิยายที่เก็บไว้" เป็น 2 แท็บ: "แนะนำ" (เจ้าของ pin เองได้ สูงสุด 8 เรื่อง —
-- ดู MAX_FEATURED_BOOKMARKS ใน social.service.ts) กับ "ทั้งหมด" (infinite scroll ของที่เก็บ
-- เข้าคลังทั้งหมด) — reuse ตาราง work_bookmarks เดิม แค่เพิ่ม flag ว่าอันไหนถูก pin ไว้
ALTER TABLE work_bookmarks ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;
