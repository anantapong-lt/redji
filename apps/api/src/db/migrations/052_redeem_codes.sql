-- =============================================================
-- Novel Platform — ระบบใช้โค้ด (2026-08-18, ใหม่)
-- =============================================================
-- ปุ่ม "ใช้โค้ด" ในเนวบาร์เดิมเป็น dead link (ลิงก์ไป /redeem-code ที่ไม่เคยมีหน้าจริง) — ทำให้
-- ใช้งานได้จริง รองรับ 2 ประเภทตามที่ user ขอ:
--   1. instant_coins        — กรอกโค้ด → บวกเหรียญเข้าบัญชีทันที (value = จำนวนเหรียญ)
--   2. topup_bonus_percent  — กรอกโค้ด → เปิดสิทธิ์โบนัส % ไว้รอ ใช้ได้ครั้งเดียว มีเวลาจำกัด
--      หลังกรอก (bonus_window_hours ชม. ค่า default 72 = 3 วัน) พอเติมเงินครั้งถัดไปภายในเวลานั้น
--      จะได้โบนัส % เพิ่มอัตโนมัติ (ผูกกับ completeTopupTransaction() ใน topup.service.ts)
--
-- redeem_codes      = แคตตาล็อกโค้ด (แอดมินสร้าง/จัดการ)
-- redeem_code_uses  = ประวัติการแลกแต่ละครั้ง + สถานะ (pending/consumed/expired) ของฝั่ง bonus

CREATE TABLE IF NOT EXISTS redeem_codes (
  id                 BIGSERIAL PRIMARY KEY,
  code               TEXT UNIQUE NOT NULL,           -- เก็บเป็นตัวพิมพ์ใหญ่เสมอ (normalize ที่ service layer)
  type               TEXT NOT NULL CHECK (type IN ('instant_coins', 'topup_bonus_percent')),
  value              NUMERIC(10,2) NOT NULL,         -- instant_coins = จำนวนเหรียญ, topup_bonus_percent = % (เช่น 20.00)
  bonus_window_hours INTEGER,                        -- เฉพาะ topup_bonus_percent — มีเวลาเท่าไหร่หลังแลกโค้ดถึงใช้สิทธิ์ได้ (null = ใช้ default 72 ที่ service layer)
  max_uses           INTEGER,                        -- จำนวนครั้งที่แลกได้รวมทุกคน — null = ไม่จำกัด
  max_uses_per_user  INTEGER NOT NULL DEFAULT 1,
  used_count         INTEGER NOT NULL DEFAULT 0,
  valid_from         TIMESTAMPTZ,
  valid_until        TIMESTAMPTZ,
  label              TEXT,                           -- โน้ตของแอดมิน เช่น "แคมเปญเปิดตัว ส.ค. 2026"
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_by         BIGINT REFERENCES users(id),
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS redeem_code_uses (
  id                  BIGSERIAL PRIMARY KEY,
  code_id             BIGINT NOT NULL REFERENCES redeem_codes(id),
  user_id             BIGINT NOT NULL REFERENCES users(id),
  type                TEXT NOT NULL,                 -- snapshot ของ redeem_codes.type ตอนแลก (กันโค้ดถูกแก้ทีหลังแล้วประวัติเก่าเพี้ยน)
  value               NUMERIC(10,2) NOT NULL,         -- snapshot ของ redeem_codes.value ตอนแลก
  status              TEXT NOT NULL DEFAULT 'consumed' CHECK (status IN ('pending', 'consumed', 'expired')),
                       -- instant_coins ได้ 'consumed' ทันที, topup_bonus_percent ได้ 'pending' ก่อน
  expires_at          TIMESTAMPTZ,                    -- เฉพาะ pending: หมดเขตใช้สิทธิ์เมื่อไหร่
  consumed_at         TIMESTAMPTZ,
  consumed_topup_id   BIGINT REFERENCES topup_transactions(id),
  ledger_id           BIGINT REFERENCES coin_ledger(id),
  redeemed_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_redeem_code_uses_user_code ON redeem_code_uses(user_id, code_id);
CREATE INDEX IF NOT EXISTS idx_redeem_code_uses_pending    ON redeem_code_uses(user_id, expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_redeem_code_uses_code       ON redeem_code_uses(code_id, redeemed_at DESC);

-- ---- ขยาย coin_ledger.reason ให้รองรับที่มาใหม่จากการแลกโค้ด ----
ALTER TABLE coin_ledger DROP CONSTRAINT IF EXISTS coin_ledger_reason_check;
ALTER TABLE coin_ledger ADD CONSTRAINT coin_ledger_reason_check
  CHECK (reason IN ('topup', 'purchase', 'refund', 'admin_adjust', 'withdrawal', 'redeem_code'));

-- ---- permission action ใหม่ (migration 047) — เข้าเงื่อนไขเดียวกับ economy อื่นๆ (level >= 9,
-- level 8 ไม่ได้สิทธิ์นี้โดย default เพราะเป็นการสร้างมูลค่าเหรียญขึ้นมาตรงๆ เหมือนอนุมัติถอนเงิน) ----
INSERT INTO permission_actions (key, category, label, description, sort_order) VALUES
  ('economy.redeem_codes.manage', 'economy', 'จัดการโค้ดเติมเหรียญ/โบนัส', 'สร้าง/แก้ไข/ปิดใช้งานโค้ด และดูประวัติการแลก', 4);

INSERT INTO permission_matrix (action_key, level, allowed)
SELECT 'economy.redeem_codes.manage', lvl, (lvl >= 9)
FROM unnest(ARRAY[8, 9, 10]) AS lvl;
