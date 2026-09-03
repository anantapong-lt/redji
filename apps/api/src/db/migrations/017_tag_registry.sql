-- Migration 017: Tag registry (tags + work_tags)
--
-- user ขอระบบจัดการ "หมวดหมู่ย่อย" (tag) แบบ TikTok ให้ครบขึ้น: (1) ลบ tag ขยะที่ไม่มีนักเขียน
-- ใช้เกิน 3 คนภายใน 30 วัน (2) จำกัดโควต้าสร้าง tag ใหม่ 25 อัน/เดือน/นักเขียน — ทั้ง 2 อย่าง
-- ต้องรู้ว่า tag ไหนสร้างเมื่อไหร่/ใครสร้าง/ถูกใช้กี่เรื่อง/กี่นักเขียน ซึ่ง works.tags (TEXT[]
-- เดิม) เป็น free text ล้วนๆ ไม่มี metadata พวกนี้เก็บไว้เลย จึงต้องมีตารางแยก
--
-- works.tags (array) ยังคงเป็น source of truth สำหรับแสดงผล/กรองค้นหาเหมือนเดิมทุกอย่าง
-- ไม่แตะ — 2 ตารางนี้เป็น registry คู่ขนานไว้ track เฉยๆ (เขียนพร้อมกันทุกครั้งที่ works.tags
-- เปลี่ยน ดู syncWorkTags() ใน writer.service.ts)

CREATE TABLE IF NOT EXISTS tags (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_by BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ใช้เช็คโควต้ารายเดือนของนักเขียนแต่ละคน (WHERE created_by = ? AND created_at >= เดือนนี้)
CREATE INDEX IF NOT EXISTS idx_tags_created_by_created_at ON tags(created_by, created_at);

CREATE TABLE IF NOT EXISTS work_tags (
  p_id       BIGINT NOT NULL REFERENCES works(p_id) ON DELETE CASCADE,
  tag_id     BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  author_id  BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (p_id, tag_id)
);

-- ใช้นับจำนวนเรื่อง/นักเขียนที่ใช้ tag แต่ละอัน (GROUP BY tag_id) — ทั้งตอนแสดง count
-- ในหน้าแนะนำ และตอนเช็คว่า tag ไหนควรถูกลบทิ้ง (นักเขียน distinct <= 3 หลัง 30 วัน)
CREATE INDEX IF NOT EXISTS idx_work_tags_tag_id ON work_tags(tag_id);
