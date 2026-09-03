-- Migration 014: ย้าย "คำเรียกตอน" จากระดับเรื่อง (works.episode_label) → ระดับตอน (work_ep.episode_label)
--
-- เหตุผล: เดิมคำเรียกตอนเป็นค่าเดียวทั้งเรื่อง ใช้ได้แค่กรณีเรื่องทั้งเรื่องใช้คำเดียวกันตลอด
-- แต่ user ต้องการแบ่งเป็นช่วงได้ (เช่นตอน 1-79 = "ตอนที่", ตอน 80-102 = "บทที่ 4 ตอนที่")
-- จึงต้องเก็บคำเรียกไว้ที่ระดับตอนแทน — ตอนใหม่ที่สร้างโดยไม่ระบุคำเรียกเอง จะ default ไปตาม
-- คำเรียกของตอนล่าสุด (ep_no สูงสุด) ของเรื่องนั้นแทน (ดู logic ใน writer.service.ts)
ALTER TABLE work_ep ADD COLUMN IF NOT EXISTS episode_label TEXT;

-- ย้ายข้อมูลเดิม: เรื่องที่เคยตั้ง works.episode_label ไว้แล้ว copy ค่านั้นลงทุกตอนที่มีอยู่แล้ว
-- กันไม่ให้ "คำเรียกตอน" ที่ตั้งไว้ก่อนหน้าหายไปตอน migrate
UPDATE work_ep ep
SET episode_label = w.episode_label
FROM works w
WHERE ep.p_id = w.p_id
  AND w.episode_label IS NOT NULL
  AND ep.episode_label IS NULL;

-- works.episode_label ไม่ใช้เป็น source of truth อีกต่อไป (เก็บคอลัมน์ไว้เฉยๆ ไม่ลบ กันพัง
-- โค้ดเก่าที่อาจยังอ้างถึง — ใช้ per-episode ผ่าน work_ep.episode_label แทนทั้งหมดแล้ว)
