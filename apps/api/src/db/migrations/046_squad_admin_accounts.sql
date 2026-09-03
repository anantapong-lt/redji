-- Migration 046: "หน่วยรบ" (admin/squad) — ระบบสร้าง/จัดการบัญชีแอดมิน level 8-9 โดย level 9-10
-- (มติ 2026-08-12)
--
-- created_by_admin_id — ใครสร้างบัญชีนี้ (level 9 สร้าง level 8, level 10 สร้าง level 9) NULL
-- สำหรับบัญชีทั่วไปที่สมัครเองผ่าน /auth/register (ไม่ใช่ทุกบัญชีจะมีคนสร้างให้)
--
-- squad_monthly_quota — โควตาสร้างบัญชี level 8 ต่อเดือนของ admin level 9 คนนั้น (level 10 ตั้งให้
-- เป็นรายคนได้) NULL = ใช้ค่า default กลาง (3 ตามที่ user ระบุ) ไม่ต้องมีแถวถ้าไม่เคยถูกปรับแต่ง
-- ไม่มีความหมายสำหรับ level อื่นนอกจาก 9 (level 10 ไม่จำกัดอยู่แล้วไม่ต้องเช็คโควตา)
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_admin_id BIGINT REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS squad_monthly_quota INTEGER CHECK (squad_monthly_quota IS NULL OR squad_monthly_quota >= 0);

CREATE INDEX IF NOT EXISTS idx_users_created_by_admin_id ON users(created_by_admin_id) WHERE created_by_admin_id IS NOT NULL;
