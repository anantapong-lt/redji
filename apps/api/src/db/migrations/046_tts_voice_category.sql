-- 046_tts_voice_category.sql
-- Voice-category reservation system for tts_work_character_labels — ดู Tier1_DesignCore.md ข้อ 4.
-- voice_category = ชื่อโฟลเดอร์เสียง (free-text เช่น "handsome") voice_index = ลำดับจองต่อเรื่อง
-- (p_id) ต่อหมวด เพิ่มขึ้นเรื่อยๆ ไม่ reuse ซ้ำแม้ตัวละครเดิมเปลี่ยน/ลบหมวด worker เป็นคน
-- wrap-around เองตอน resolve เป็นไฟล์จริง (ทะเบียนไฟล์จริงยังอยู่ worker-side JSON เหมือนเดิม)
-- voice_shared = true เมื่อ pin ด้วย "!" ต่อท้าย ให้ตัวละครอื่นใช้ไฟล์เดียวกันร่วมได้ (ไม่ sticky)

ALTER TABLE tts_work_character_labels
  ADD COLUMN IF NOT EXISTS voice_category TEXT,
  ADD COLUMN IF NOT EXISTS voice_index INTEGER,
  ADD COLUMN IF NOT EXISTS voice_shared BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tts_character_labels_voice_category
  ON tts_work_character_labels(p_id, voice_category, voice_index)
  WHERE voice_category IS NOT NULL;
