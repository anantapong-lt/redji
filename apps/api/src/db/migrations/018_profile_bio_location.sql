-- Migration 018: เพิ่ม bio/location ให้หน้าตั้งค่าโปรไฟล์ (user ส่ง reference มาให้ทำ)
--
-- "เว็บไซต์" ไม่ต้องเพิ่มคอลัมน์ใหม่ — ใช้ users.social_media (JSONB) เดิมที่มี index
-- signature เปิดกว้างรับ key ไหนก็ได้อยู่แล้ว (migration 001) เก็บเป็น social_media.website แทน

ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;
