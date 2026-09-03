-- Migration 006: cartoon_ep_image → work_ep_image
-- migration 002 เปลี่ยนชื่อตารางส่วนใหญ่จาก cartoons→works, manga_ep→work_ep ฯลฯ
-- แล้ว แต่พลาดตารางรูปภาพตัวนี้ไว้ ยังเหลือชื่อ "cartoon" ค้างอยู่ — ตัวนี้แก้ให้ตรงกัน
ALTER TABLE IF EXISTS cartoon_ep_image RENAME TO work_ep_image;
