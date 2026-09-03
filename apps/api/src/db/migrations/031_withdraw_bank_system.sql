-- 031_withdraw_bank_system.sql
-- 2026-08-06
--
-- หน้า "ถอนเงิน" ของนักเขียน (writer/withdraw) — เปลี่ยนโมเดลการถอนจากเดิม (ถอนยอด sales
-- ทั้งหมดในครั้งเดียว, ไม่มีบัญชีธนาคารผูกไว้) เป็นแบบใหม่: ผู้เขียนพิมพ์จำนวนเงินเอง (500-50,000
-- บาท/ครั้ง), โอนเข้าบัญชีธนาคารที่ผูกไว้ล่วงหน้าเท่านั้น (ตัดระบบคอยน์ทิ้งทั้งหมด) — ต้องมีบัญชี
-- ธนาคารที่ยืนยันแล้วก่อนถึงจะถอนได้
--
-- withdrawals ตอนสร้าง (001_init.sql) มี fee_percent/rate ไว้รองรับ "หักส่วนแบ่งรายได้ %"
-- (แนวคิดเดิม: ถอนทั้งก้อน sales*rate) — ตอนนี้เปลี่ยนเป็นค่าธรรมเนียมคงที่ 20 บาท/ครั้ง (หลังใช้
-- สิทธิ์ถอนฟรี 2 ครั้ง/เดือนหมด) เลยเลิกใช้ 2 คอลัมน์นี้ไปเลย (ตาราง withdrawals ยังไม่มีแถวจริง
-- เลยสักแถว — เช็คแล้วก่อนเขียน migration นี้ ปลอดภัยที่จะ DROP ตรงๆ ไม่ต้องมี backfill)

-- ---- 1. บัญชีธนาคารปัจจุบันของ user (ค่าล่าสุดที่ยืนยันแล้ว ใช้ตอนถอนเงินจริง) ----
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bank_code           TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name   TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT;

-- ---- 2. BANK_CHANGE_REQUESTS ----
-- คำขอตั้ง/เปลี่ยนบัญชีธนาคาร — ต้องแนบหลักฐาน (สมุดบัญชี+บัตรประชาชน) รอแอดมินอนุมัติก่อน
-- ถึงจะเข้าไปอัปเดต users.bank_* จริง (ดู approveBankChangeRequest ใน admin.service.ts)
CREATE TABLE IF NOT EXISTS bank_change_requests (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT NOT NULL REFERENCES users(id),
  bank_code      TEXT NOT NULL,
  account_name   TEXT NOT NULL,
  account_number TEXT NOT NULL,
  reason         TEXT,
  document_url   TEXT NOT NULL,             -- ภาพสมุดบัญชี+บัตรประชาชน (R2)
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  review_note    TEXT,
  reviewed_by    BIGINT REFERENCES users(id),
  reviewed_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_change_requests_user ON bank_change_requests(user_id, status);

-- กันส่งคำขอซ้ำซ้อนพร้อมกันหลายใบ (เหมือน user_detail_one_pending_per_user — migration 024)
CREATE UNIQUE INDEX IF NOT EXISTS bank_change_requests_one_pending_per_user
  ON bank_change_requests(user_id) WHERE status = 'pending';

-- ---- 3. WITHDRAWALS — เปลี่ยนโมเดลค่าธรรมเนียม + snapshot บัญชีธนาคาร ณ ตอนขอถอน ----
-- (snapshot ไว้ในแถว ไม่ join จาก users สด เพราะถ้า user เปลี่ยนบัญชีธนาคารทีหลัง ประวัติการ
-- ถอนเก่าต้องยังโชว์บัญชีที่ใช้จริงตอนนั้น ไม่ใช่บัญชีปัจจุบัน)
ALTER TABLE withdrawals
  DROP COLUMN IF EXISTS fee_percent,
  DROP COLUMN IF EXISTS rate,
  ADD COLUMN IF NOT EXISTS fee_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,  -- ค่าธรรมเนียมคงที่ (20 บาท ถ้าเกินโควตาฟรี)
  ADD COLUMN IF NOT EXISTS bank_code      TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS account_name   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS account_number TEXT NOT NULL DEFAULT '';
