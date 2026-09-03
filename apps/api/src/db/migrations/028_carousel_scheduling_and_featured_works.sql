-- 028_carousel_scheduling_and_featured_works.sql
-- 2026-08-04 — ต่อระบบ "ตั้งหน้าเว็บไซต์" ให้ทำงานจริงตามที่ user ขอ
--
-- carousels: เดิมมีแค่ title/subtitle/image_path/link_url/sort_order/status ไม่มีเรื่องตั้งเวลา
-- เผยแพร่/สิ้นสุด และไม่มี "เวลาที่แสดงก่อนเปลี่ยน" (ต่อสไลด์) เลย — เพิ่มเข้ามาตามสเปคที่ user ให้
--
-- featured_works: ตารางใหม่ทั้งหมด สำหรับระบบ "นิยายแนะนำแบบ Cheesy" (บูสต์นิยายที่เลือกเองให้ไป
-- ปนอยู่ในแถวหน้าแรก) — section ผูกกับค่า sort ที่มีอยู่แล้วของ GET /works ตรงๆ (sales/popular/
-- latest = 3 แถวบนหน้าแรกจริงในโค้ดปัจจุบัน "เรื่องเด่นประจำสัปดาห์"/"นิยมตลอดกาล"/"ใหม่ล่าสุด")
-- ไม่มี cron/queue ในโปรเจกต์นี้เลย (ดู KNOWN_ISSUES.md) — expires_at กรองแบบ query-time
-- (WHERE expires_at >= now()) ตาม pattern เดียวกับที่ระบบอื่นในนี้ใช้ทั้งหมด (ban window, flag
-- consensus window, topup cap ฯลฯ)

ALTER TABLE carousels
  ADD COLUMN start_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN end_at          TIMESTAMPTZ NULL,
  ADD COLUMN display_seconds NUMERIC(5,2) NOT NULL DEFAULT 5,
  ADD COLUMN note            TEXT NULL;

CREATE TABLE featured_works (
  id          BIGSERIAL PRIMARY KEY,
  p_id        BIGINT NOT NULL REFERENCES works(p_id),
  section     TEXT NOT NULL CHECK (section IN ('sales', 'popular', 'latest')),
  sort_order  INT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_by  BIGINT NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_featured_works_section_expires ON featured_works (section, expires_at);
