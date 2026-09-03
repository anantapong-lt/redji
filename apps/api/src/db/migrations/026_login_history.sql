-- 026_login_history.sql
-- 2026-07-30
--
-- โครงเปล่าๆ สำหรับ "ประวัติ login/IP" (ข้อ 6 ที่คุยกันไว้ตอนดีไซน์เลเวลแอดมิน) — ตาม user ขอ
-- "ทำไว้เป็นโครงยังไม่ต้องทำจริง" คือแค่เริ่มเก็บข้อมูลดิบไว้ก่อน ยังไม่มีหน้า admin ดู/วิเคราะห์
-- อะไรเลย (รอออกแบบ + คุยรายละเอียดว่าจะเก็บ/ใช้ยังไงต่ออีกที) และยังไม่มี retention policy
-- (ยังไม่ลบข้อมูลเก่าอัตโนมัติ — เป็นอีกจุดที่ต้องตัดสินใจทีหลัง)

CREATE TABLE IF NOT EXISTS login_history (
  id          BIGSERIAL PRIMARY KEY,
  -- null = พยายาม login ไม่สำเร็จด้วย identifier ที่ไม่ตรงกับ user ไหนเลย (username/email ผิด)
  user_id     BIGINT REFERENCES users(id),
  -- ค่าที่กรอกตอน login (username หรือ email) เก็บไว้เสมอไม่ว่าสำเร็จหรือไม่ — เอาไว้สืบภายหลังได้
  -- ว่ามีคนพยายาม brute-force บัญชี/username ไหนบ้าง
  identifier  TEXT NOT NULL,
  success     BOOLEAN NOT NULL,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_created_at ON login_history(created_at DESC);
