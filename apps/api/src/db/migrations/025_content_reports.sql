-- 025_content_reports.sql
-- 2026-07-30
--
-- ระบบรายงานเนื้อหาจริง (แทนปุ่ม "รายงาน" ที่เป็น mock devToast.info() อยู่ 3 จุด:
-- novel-comments-section.tsx, episode-comments-section.tsx, novel-hero-section.tsx)
--
-- target_type/target_id เป็น polymorphic (เทียบ p_id ของ works หรือ id ของ work_comments
-- แล้วแต่ type) — เลือกแบบเดียวกับ admin_action_requests (migration 024) คือ 1 ตารางรวม
-- ไม่แยกตารางย่อยตาม target_type เพื่อลดความซ้ำซ้อนของ service functions

CREATE TABLE IF NOT EXISTS content_reports (
  id            BIGSERIAL PRIMARY KEY,
  target_type   TEXT NOT NULL CHECK (target_type IN ('comment', 'work')),
  target_id     BIGINT NOT NULL,
  reported_by   BIGINT NOT NULL REFERENCES users(id),
  reason        TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  reviewed_by   BIGINT REFERENCES users(id),
  review_note   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_content_reports_status
  ON content_reports(status, created_at DESC);

-- กันคนเดิมกดรายงานเป้าหมายเดียวกันซ้ำรัวๆ ระหว่างที่คำขอเก่ายังไม่ถูกตรวจ — พอ resolve/dismiss
-- ไปแล้วรายงานซ้ำได้อีก (เผื่อมีพฤติกรรมผิดซ้ำใหม่จริง) เหมือน user_detail_one_pending_per_user
CREATE UNIQUE INDEX IF NOT EXISTS content_reports_one_pending_per_reporter
  ON content_reports(target_type, target_id, reported_by) WHERE status = 'pending';
