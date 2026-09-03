-- =============================================================
-- Novel Platform — แก้ไขข้อมูลนักเขียนหลังอนุมัติแล้ว (2026-08-18, ใหม่)
-- =============================================================
-- เดิม user_detail.status='approve' ล็อกฟอร์มถาวร ไม่มีทางแก้ไขได้อีกเลย (ต้องติดต่อทีมงานเอง) —
-- user ขอให้แก้ไขได้จริง โดยการแก้ไขต้องผ่านการอนุมัติซ้ำจากแอดมินก่อนถึงจะมีผล เหมือนตอนสมัครครั้ง
-- แรก — ใช้ pattern เดียวกับที่ submitWriterApplication() มีอยู่แล้ว (resubmit หลัง rejected = insert
-- แถวใหม่ เก็บประวัติเดิมไว้) มาใช้กับการแก้ไขด้วย: แก้ไขแต่ละครั้ง = insert แถวใหม่สถานะ pending
--
-- application_type แยกว่าแถวนี้คือ "สมัครเป็นนักเขียนใหม่" (เลื่อน level 1→6 ตอนอนุมัติ) หรือ
-- "แก้ไขข้อมูลของนักเขียนที่อนุมัติแล้ว" (ไม่แตะ level เลย แค่อัปเดตข้อมูลที่แสดง) — ใช้แยกทั้ง
-- logic ตอนอนุมัติ (approveWriterApplication) และการจัดหมวดหมู่ฝั่งแอดมิน (ตามที่ user ขอ
-- "แยกประเภทอะไรชัดเจน") — default 'new_writer' ให้แถวเก่าทั้งหมดที่มีอยู่แล้ว (ถูกต้องตามจริง
-- เพราะระบบแก้ไขไม่เคยมีมาก่อนหน้านี้เลย)

ALTER TABLE user_detail
  ADD COLUMN IF NOT EXISTS application_type TEXT NOT NULL DEFAULT 'new_writer'
    CHECK (application_type IN ('new_writer', 'edit'));

CREATE INDEX IF NOT EXISTS idx_user_detail_type_status ON user_detail(application_type, status);
