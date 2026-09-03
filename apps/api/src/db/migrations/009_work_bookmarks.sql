-- Migration 009: "เก็บเข้าคลัง" (bookmark) แยกออกจาก "หัวใจ" (work_favorite)
--
-- ค้นพบระหว่างต่อหน้านิยายจริง (2026-07-17): endpoint /social/favorites เดิม (ตาราง
-- work_favorite) ถูกตั้งชื่อในโค้ดว่า "บุ๊กมาร์ก" ทั้งที่มติ 2026-07-12 ตัดสินใจให้ตาราง
-- นี้เป็นตัวนับ "หัวใจ" (แค่บอกว่าชอบ ไม่ได้ตั้งใจเก็บไว้อ่านทีหลัง) — user ยืนยันให้แยก
-- เป็นคนละระบบจริงจัง: work_favorite = หัวใจ, work_bookmarks (ใหม่) = เก็บเข้าคลัง
CREATE TABLE IF NOT EXISTS work_bookmarks (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id),
  p_id       BIGINT NOT NULL REFERENCES works(p_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, p_id)
);
