-- Migration 023: บุ๊คมาร์คแยกรายตอน ("เก็บตอนโปรดไว้ดูทีหลัง") — 2026-07-29
--
-- คนละอันกับ work_bookmarks (migration 009, เก็บทั้งเรื่อง/ใช้เป็น "ติดตามอัปเดต" ในหน้า
-- Feed ด้วย) — user ถามว่ามีบุ๊คมาร์คแยกตอนไหม แล้วขอให้ทำ: เก็บตอนที่ชอบเป็นรายตอนได้ต่างหาก
-- ไม่เกี่ยวกับการ follow ทั้งเรื่อง
CREATE TABLE IF NOT EXISTS work_ep_bookmarks (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id),
  ep_id      BIGINT NOT NULL REFERENCES work_ep(ep_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, ep_id)
);

CREATE INDEX IF NOT EXISTS idx_work_ep_bookmarks_user ON work_ep_bookmarks(user_id);
