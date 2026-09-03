-- =============================================================
-- Novel Platform — ระบบชวนเพื่อน / Affiliate (2026-08-18, ใหม่)
-- =============================================================
-- ต่อยอดจากระบบ redeem_codes/redeem_code_uses (migration 052) — เพิ่มประเภทที่ 3 'referral':
-- user ทั่วไปสร้างโค้ดของตัวเองได้ 1 โค้ด (auto-gen จาก u_name, ดู referral.service.ts) แชร์ให้
-- เพื่อนกรอกผ่าน "ใช้โค้ด" เหมือนโค้ดอื่นๆ — คนที่กรอก (invitee) ได้ 10 เหรียญทันที เจ้าของโค้ด
-- (referrer, = redeem_codes.created_by) ได้ 1% ของเหรียญที่เพื่อนเติมทุกครั้งที่เติมเงิน (ไม่ใช่
-- ครั้งเดียว ไม่มีวันหมดอายุ) จำกัด 10 คนต่อโค้ด (ใช้ max_uses เดิมที่มีอยู่แล้ว)
--
-- ต่างจาก topup_bonus_percent (ได้สิทธิ์ครั้งเดียวแล้วหมด, redeem_code_uses.status: pending→
-- consumed) ตรงที่ referral เป็นความสัมพันธ์ถาวร — status ใหม่ 'active' ไม่มีวันเปลี่ยนเป็น
-- consumed เลย (เช็คซ้ำได้ทุกครั้งที่เพื่อนเติมเงิน ดู completeTopupTransaction() ใน topup.service.ts)

ALTER TABLE redeem_codes DROP CONSTRAINT IF EXISTS redeem_codes_type_check;
ALTER TABLE redeem_codes ADD CONSTRAINT redeem_codes_type_check
  CHECK (type IN ('instant_coins', 'topup_bonus_percent', 'referral'));

ALTER TABLE redeem_code_uses DROP CONSTRAINT IF EXISTS redeem_code_uses_status_check;
ALTER TABLE redeem_code_uses ADD CONSTRAINT redeem_code_uses_status_check
  CHECK (status IN ('pending', 'consumed', 'expired', 'active'));
