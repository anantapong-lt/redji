-- Migration 005: one-shot flag (นิยาย/การ์ตูนที่ตั้งใจให้มีแค่ตอนเดียวตลอดไป)
ALTER TABLE works ADD COLUMN IF NOT EXISTS is_one_shot BOOLEAN NOT NULL DEFAULT false;
