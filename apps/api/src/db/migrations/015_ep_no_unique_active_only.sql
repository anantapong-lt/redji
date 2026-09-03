-- Migration 015: แก้ unique constraint ของ (p_id, ep_no) ให้คุมเฉพาะตอนที่ active เท่านั้น
--
-- Bug จริงที่ user เจอ (2026-07-18): ตอนที่ soft-delete แล้ว (status='deleted') ยังยึด
-- ep_no ของตัวเองไว้อยู่ เพราะ constraint เดิม (work_ep_p_id_ep_no_key) คุมทุกแถวไม่ว่าจะ
-- active หรือ deleted — พอลบตอนแล้วพยายามสร้างตอนใหม่ด้วยเลขเดิม โค้ดเช็คแค่ตอน active
-- (ไม่เจอ conflict) แต่พอ INSERT จริงชน raw constraint ที่ DB เพราะแถวเก่ายังอยู่ กลายเป็น error
--
-- แก้โดยเปลี่ยนเป็น partial unique index คุมเฉพาะแถวที่ status='active' — ตอนที่ถูกลบแล้ว
-- จะไม่กันเลขลำดับตอนอีกต่อไป ตรงกับเจตนาจริงของ soft-delete
ALTER TABLE work_ep DROP CONSTRAINT IF EXISTS work_ep_p_id_ep_no_key;

CREATE UNIQUE INDEX IF NOT EXISTS work_ep_p_id_ep_no_active_key
  ON work_ep (p_id, ep_no)
  WHERE status = 'active';
