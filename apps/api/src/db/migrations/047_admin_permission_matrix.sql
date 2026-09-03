-- =============================================================
-- Novel Platform — Admin Permission Matrix (2026-08-17, ใหม่)
-- =============================================================
--
-- ระบบสิทธิ์แบบปรับได้เอง (ฟีลคล้าย Discord role permission) — level 10 (shareholder) ปรับได้เองว่า
-- level 8/9 ทำอะไรได้บ้าง โดยไม่ต้องแก้โค้ด/redeploy ดูหน้า apps/admin "ตั้งค่า" (level 10 เท่านั้น)
--
-- permission_actions = แคตตาล็อกของ "การกระทำ" ที่ปรับสิทธิ์ได้ (จัดหมวดหมู่ไว้ตาม category)
-- permission_matrix   = ตาราง action_key × level(8/9/10) → allowed จริง (หน้าตั้งค่าแก้ตรงนี้)
--
-- level 10 ไม่ถูกกรองโดยตารางนี้เลยจริงๆ (เช็ค short-circuit ใน admin-permissions.service.ts ไม่ใช่ SQL)
-- กันเจ้าของเว็บกดพลาดจนล็อกตัวเองออกจากระบบ — แถวนี้ seed เป็น true หมดไว้แค่ให้ตรงกับที่โชว์ใน UI

CREATE TABLE permission_actions (
  key           TEXT PRIMARY KEY,
  category      TEXT NOT NULL,
  label         TEXT NOT NULL,
  description   TEXT,
  sort_order    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE permission_matrix (
  action_key    TEXT NOT NULL REFERENCES permission_actions(key) ON DELETE CASCADE,
  level         INTEGER NOT NULL CHECK (level IN (8, 9, 10)),
  allowed       BOOLEAN NOT NULL DEFAULT false,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    BIGINT REFERENCES users(id),
  PRIMARY KEY (action_key, level)
);

-- ---- แคตตาล็อก action ทั้งหมด (ตรงกับทุกจุดที่เคย hardcode level check อยู่ในระบบตอนนี้) ----
INSERT INTO permission_actions (key, category, label, description, sort_order) VALUES
  ('economy.revenue_rate.edit',            'economy',    'ปรับส่วนแบ่งรายได้นักเขียน',       'ปรับ % ส่วนแบ่งรายได้ของนักเขียนแต่ละคน (±8pp จากค่ากลาง)', 1),
  ('economy.withdrawal.manage',            'economy',    'อนุมัติ/ปฏิเสธคำขอถอนเงิน',        'ดูรายการ + อนุมัติ/ปฏิเสธคำขอถอนเงินของนักเขียน', 2),
  ('economy.bank_change.manage',           'economy',    'อนุมัติ/ปฏิเสธเปลี่ยนบัญชีธนาคาร',  'อนุมัติคำขอตั้ง/เปลี่ยนบัญชีธนาคารรับเงินของนักเขียน', 3),

  ('moderation.user.ban',                  'moderation', 'แบน/ยกเลิกแบนผู้ใช้โดยตรง',         'แบนหรือยกเลิกแบนบัญชีผู้ใช้ทันทีโดยไม่ต้องขออนุมัติ', 1),
  ('moderation.user.suspend_activity',     'moderation', 'ระงับ/ยกเลิกระงับการเคลื่อนไหว',    'ระงับไม่ให้ผู้ใช้ทำกิจกรรมบนเว็บชั่วคราว', 2),
  ('moderation.user.suspend_spending',     'moderation', 'ระงับ/ยกเลิกระงับการใช้จ่าย',       'ระงับไม่ให้ผู้ใช้ใช้จ่าย/เติมเงินชั่วคราว', 3),
  ('moderation.user.perma_delete',         'moderation', 'ลบบัญชีถาวร',                     'ลบบัญชีผู้ใช้ออกจากระบบถาวร (anonymize) ย้อนคืนไม่ได้', 4),
  ('moderation.flag.review',               'moderation', 'ตัดสิน flag ผู้ใช้',               'อนุมัติ (execute) หรือยกเลิก flag ที่ level 8 ส่งมา', 5),
  ('moderation.spending_series.view',      'moderation', 'ดูกราฟการใช้จ่ายผู้ใช้',           'ดูกราฟยอดใช้จ่ายรายผู้ใช้ตามช่วงเวลา', 6),
  ('moderation.ban_request.review',        'moderation', 'อนุมัติ/ปฏิเสธคำขอแบน',            'รีวิวคำขอแบนที่ level 8 ส่งเข้ามา', 7),
  ('moderation.level8_request.submit',     'moderation', 'ส่งคำขอเพิ่มบัญชี level 8',        'ส่งคำขอสร้างบัญชีแอดมิน level 8 ให้ level 10 อนุมัติ', 8),
  ('moderation.level8_request.review',     'moderation', 'อนุมัติ/ปฏิเสธคำขอเพิ่ม level 8',   'รีวิวคำขอเพิ่มบัญชีแอดมิน level 8', 9),
  ('moderation.writer_application.review', 'moderation', 'อนุมัติ/ปฏิเสธใบสมัครนักเขียน',    'ตัดสินใบสมัครเป็นนักเขียนของผู้ใช้ทั่วไป', 10),
  ('moderation.content_report.review',     'moderation', 'ปิดเคส/ยกเลิกรายงานเนื้อหา',       'ตัดสินรายงานเนื้อหาที่ผู้ใช้แจ้งเข้ามา', 11),

  ('squad.manage',                         'squad',      'เข้าหน้าหน่วยรบ',                  'ดูลิสต์/ระงับ/รีเซ็ตรหัสผ่าน/ลบบัญชีแอดมินที่จัดการผ่านหน่วยรบ', 1),
  ('squad.create_level1',                  'squad',      'สร้างบัญชี level 1 (เตรียมนักเขียนของเว็บ)', 'สร้างบัญชีเปล่าเตรียมตั้งเป็นนักเขียนของเว็บทีหลัง', 2),
  ('squad.create_level8',                  'squad',      'สร้างบัญชีแอดมิน level 8',         'สร้างบัญชีแอดมินย่อยใหม่ (มีโควตา/เดือน)', 3),
  ('squad.create_level9',                  'squad',      'สร้างบัญชีแอดมิน level 9',         'สร้างบัญชีแอดมินรองใหม่', 4),
  ('squad.quota.set',                      'squad',      'ตั้งโควตาสร้างบัญชี level 8/เดือน', 'ปรับจำนวนบัญชี level 8 ที่แอดมิน level 9 คนหนึ่งสร้างได้ต่อเดือน', 5),

  ('content.works.manage',                 'content',    'จัดการผลงาน',                      'แก้ไข/ลบแบบซ่อนผลงานของนักเขียนคนไหนก็ได้', 1),
  ('content.works.perma_delete',           'content',    'ลบผลงานถาวร',                      'ลบผลงานออกจากระบบถาวร ย้อนคืนไม่ได้', 2),
  ('content.house_writer.manage',          'content',    'จัดการนักเขียนของเว็บ',             'อัพนิยาย/จัดการผลงานแทนบัญชี "นักเขียนของเว็บ"', 3),
  ('content.carousel.manage',              'content',    'จัดการ Carousel หน้าแรก',           'เพิ่ม/แก้/ลบ/จัดลำดับแบนเนอร์หน้าแรก', 4),
  ('content.featured_works.manage',        'content',    'จัดการนิยายแนะนำ',                 'เพิ่ม/เอาออก/จัดลำดับนิยายในคิวบูสต์', 5),
  ('content.announcement.manage',          'content',    'จัดการประกาศ',                     'สร้าง/แก้/ลบประกาศถึงผู้ใช้ทุกคน', 6),
  ('content.writer_message.manage',        'content',    'ส่งข้อความถึงนักเขียน',             'ส่งข้อความโดยตรงถึงนักเขียนรายคน', 7),

  ('tts.admin_panel.view',                 'tts',        'ดูแผงควบคุม TTS',                  'ดูรายการคำขอ TTS และสถานะ worker', 1),
  ('tts.admin_request.manage',             'tts',        'สร้าง/Retry/ยกเลิกคำขอ TTS',       'สร้างคำขอ TTS เอง หรือ retry/ยกเลิกงานที่ค้างอยู่', 2),

  ('system.web_settings.manage',           'system',     'แก้ web settings ทั่วไป',           'แก้ค่าตั้งค่าทั่วไปของเว็บ (key-value)', 1),
  ('system.audit_log.view',                'system',     'ดู audit log',                     'ดูประวัติการทำรายการทั้งหมดของแอดมิน', 2);

-- ---- ตาราง matrix — seed ให้ตรงกับพฤติกรรม hardcode เดิมทุกจุดเป๊ะ (ไม่มีอะไรเปลี่ยนพฤติกรรมจริง
-- จนกว่า level 10 จะเข้าไปกดปรับเอง) — level 10 default true ทุก action เสมอ ----
INSERT INTO permission_matrix (action_key, level, allowed)
SELECT key, lvl, (lvl = 10)
FROM permission_actions, unnest(ARRAY[8, 9, 10]) AS lvl;

-- เดิม level >= 9 ทำได้ (ส่วนใหญ่ของระบบ)
UPDATE permission_matrix SET allowed = true WHERE level = 9 AND action_key IN (
  'economy.revenue_rate.edit', 'economy.withdrawal.manage', 'economy.bank_change.manage',
  'moderation.user.ban', 'moderation.user.suspend_activity', 'moderation.user.suspend_spending',
  'moderation.flag.review', 'moderation.spending_series.view', 'moderation.ban_request.review',
  'moderation.level8_request.submit',
  'squad.manage', 'squad.create_level1', 'squad.create_level8',
  'content.works.manage', 'content.house_writer.manage', 'content.carousel.manage',
  'content.featured_works.manage', 'content.announcement.manage', 'content.writer_message.manage',
  'tts.admin_request.manage',
  'system.web_settings.manage', 'system.audit_log.view'
);

-- เดิมเปิดตั้งแต่ level 8 (ไม่มีการเช็คเพิ่มเกิน base gate)
UPDATE permission_matrix SET allowed = true WHERE level IN (8, 9) AND action_key IN (
  'moderation.writer_application.review', 'moderation.content_report.review',
  'tts.admin_panel.view'
);
