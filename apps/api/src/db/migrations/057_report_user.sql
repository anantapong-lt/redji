-- =============================================================
-- Novel Platform — รายงานผู้ใช้ (2026-08-18, ใหม่)
-- =============================================================
-- ปุ่ม "รายงาน" ในหน้าโปรไฟล์ (profile-header.tsx) เดิมเป็น mock devToast.info() — ต่อยอดระบบ
-- content_reports เดิม (migration 025, ขยายหมวดหมู่ที่ 032) ให้รับ target_type='user' ได้ด้วย ใช้
-- โครงเดียวกันทั้งหมด (polymorphic target_type/target_id, category, status, review flow) ไม่ต้อง
-- สร้างตารางใหม่ — target_id ของ user คือ users.id ตรงๆ

ALTER TABLE content_reports DROP CONSTRAINT IF EXISTS content_reports_target_type_check;
ALTER TABLE content_reports
  ADD CONSTRAINT content_reports_target_type_check CHECK (target_type IN ('comment', 'work', 'user'));

-- เพิ่มหมวด "คุกคาม/กลั่นแกล้ง" — เข้าเกณฑ์ทั้งรายงานคน (ตามที่ user ขอ) และคอมเม้น/นิยายด้วย
-- (ของเดิมใกล้เคียงสุดคือ 'inappropriate' แต่คำนั้นเอียงไปทาง "เนื้อหาผิดกฎ" มากกว่า "พฤติกรรมคน")
ALTER TABLE content_reports DROP CONSTRAINT IF EXISTS content_reports_category_check;
ALTER TABLE content_reports
  ADD CONSTRAINT content_reports_category_check CHECK (
    category IS NULL OR category IN (
      'content_error', 'copyright', 'unrated_18plus', 'inappropriate',
      'scam', 'spam', 'impersonation', 'harassment', 'general', 'other'
    )
  );
