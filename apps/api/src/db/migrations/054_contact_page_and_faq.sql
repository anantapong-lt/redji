-- =============================================================
-- Novel Platform — หน้า "ติดต่อแอดมิน" ใหม่: ช่องทางติดต่อ + FAQ (2026-08-18)
-- =============================================================
-- เดิม /contact-admin เป็น dead link (ไม่เคยมีหน้าจริง) — user ขอให้กลายเป็นหน้าโชว์ลิงก์ช่องทาง
-- ติดต่อภายนอก (Discord/Facebook/Line/อีเมล ฯลฯ) ที่แอดมินตั้งค่าได้ รวมกับแท็บคำถามที่พบบ่อย
--
-- web_contacts (migration 001) มีอยู่แล้วและ shape ตรงพอดี (label/url/icon_class) แต่ไม่เคยมี
-- admin CRUD เลย (ต้องเพิ่มแถวผ่าน DB ตรงๆ) — เพิ่ม sort_order/status ให้จัดลำดับ/ซ่อนได้แบบ
-- เดียวกับ categories แทนที่จะลบถาวรเสมอ

ALTER TABLE web_contacts ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE web_contacts ADD COLUMN IF NOT EXISTS status BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS faqs (
  id         BIGSERIAL PRIMARY KEY,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ---- permission action ใหม่ (migration 047) — default level >= 9 เหมือน action หมวด content อื่นๆ ----
INSERT INTO permission_actions (key, category, label, description, sort_order) VALUES
  ('content.web_contacts.manage', 'content', 'จัดการช่องทางติดต่อ', 'เพิ่ม/แก้/ลบ/จัดลำดับลิงก์ช่องทางติดต่อภายนอก (หน้าติดต่อแอดมิน + Footer)', 9),
  ('content.faq.manage',          'content', 'จัดการคำถามที่พบบ่อย', 'เพิ่ม/แก้/ลบ/จัดลำดับ FAQ ในหน้าติดต่อแอดมิน', 10);

INSERT INTO permission_matrix (action_key, level, allowed)
SELECT key, lvl, (lvl >= 9)
FROM permission_actions, unnest(ARRAY[8, 9, 10]) AS lvl
WHERE key IN ('content.web_contacts.manage', 'content.faq.manage');
