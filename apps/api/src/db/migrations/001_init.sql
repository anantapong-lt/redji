-- =============================================================
-- Novel Platform — Full Database Migration
-- รัน script นี้ใน DBeaver บน database: novelnova_db
-- =============================================================

-- ---- 1. CATEGORIES (ไม่มี FK) ----
CREATE TABLE IF NOT EXISTS categories (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  status     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ---- 2. USERS ----
CREATE TABLE IF NOT EXISTS users (
  id               BIGSERIAL PRIMARY KEY,
  uuid             TEXT UNIQUE NOT NULL,           -- ใช้ uuidv7() เสมอ
  u_name           TEXT UNIQUE NOT NULL,
  display_name     TEXT NOT NULL,
  email            TEXT UNIQUE NOT NULL,
  password_hash    TEXT NOT NULL,                  -- argon2id เท่านั้น ห้ามเก็บ plaintext/base64
  level            SMALLINT NOT NULL DEFAULT 1,    -- 1=user (2-5 ว่างไว้เผื่ออนาคต), 6=writer, 9=admin (7-8 ว่างไว้เผื่ออนาคต) — มติ 2026-07-30
  point            BIGINT NOT NULL DEFAULT 0,      -- READ ONLY — ห้าม UPDATE ตรงๆ ต้องผ่าน coin_ledger
  sales            BIGINT NOT NULL DEFAULT 0,      -- READ ONLY — ห้าม UPDATE ตรงๆ
  user_img         TEXT,
  google_id        TEXT UNIQUE,
  google_token     TEXT,                           -- ต้องซ่อนใน response เสมอ
  social_media     JSONB,                          -- { facebook, twitter, instagram, ... }
  auto_ep_purchase BOOLEAN DEFAULT false,
  load_all_images  BOOLEAN DEFAULT false,
  password_legacy  BOOLEAN DEFAULT false,          -- true = ต้อง force reset ครั้งถัดไปที่ login
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email  ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_u_name ON users(u_name);
CREATE INDEX IF NOT EXISTS idx_users_uuid   ON users(uuid);

-- ---- 3. CARTOONS ----
CREATE TABLE IF NOT EXISTS cartoons (
  p_id              BIGSERIAL PRIMARY KEY,
  uuid              TEXT UNIQUE NOT NULL,
  title             TEXT NOT NULL,
  description       TEXT,
  cover_image       TEXT,                          -- path ใน R2/S3
  author_id         BIGINT NOT NULL REFERENCES users(id),
  category_main     BIGINT REFERENCES categories(id),
  category_sub      BIGINT REFERENCES categories(id),
  type              TEXT NOT NULL CHECK (type IN ('manga','novel')),
  origin_type       SMALLINT CHECK (origin_type IN (1,2,3,4)),
                                                   -- 1=ไทย 2=ญี่ปุ่น 3=เกาหลี 4=จีน
  age_rate          TEXT CHECK (age_rate IN ('all','13+','16+','18+')),
  publish_status    SMALLINT NOT NULL DEFAULT 0,   -- 0=ซ่อน 1=เผยแพร่
  completion_status TEXT CHECK (completion_status IN ('ongoing','completed','hiatus')),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted')),
  banned            JSONB,                         -- null=ไม่แบน { banned_at, banned_by, reason }
  view_count        BIGINT NOT NULL DEFAULT 0,
  created_by        BIGINT REFERENCES users(id),
  updated_by        BIGINT REFERENCES users(id),
  deleted_at        TIMESTAMPTZ,
  deleted_by        BIGINT REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cartoons_author      ON cartoons(author_id);
CREATE INDEX IF NOT EXISTS idx_cartoons_type_status ON cartoons(type, status, publish_status);
CREATE INDEX IF NOT EXISTS idx_cartoons_uuid        ON cartoons(uuid);

-- ---- 4. TOPUP_PACKAGES ----
CREATE TABLE IF NOT EXISTS topup_packages (
  id          BIGSERIAL PRIMARY KEY,
  coin_amount BIGINT NOT NULL,
  bonus       BIGINT NOT NULL DEFAULT 0,
  price       NUMERIC(12,2) NOT NULL,              -- ห้ามใช้ FLOAT เด็ดขาด
  status      TEXT NOT NULL DEFAULT 'show' CHECK (status IN ('show','hide')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ---- 5. COIN_LEDGER (append-only — ห้าม UPDATE/DELETE เด็ดขาด) ----
CREATE TABLE IF NOT EXISTS coin_ledger (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id),
  delta           BIGINT NOT NULL,                 -- + เติม, - ซื้อ/ถอน
  reason          TEXT NOT NULL CHECK (reason IN ('topup','purchase','refund','admin_adjust','withdrawal')),
  ref_type        TEXT,                            -- 'topup_transaction' | 'ep_shop' | 'withdrawal'
  ref_id          BIGINT,
  idempotency_key TEXT UNIQUE NOT NULL,            -- ป้องกัน double-credit จาก webhook retry
  balance_after   BIGINT NOT NULL,                 -- snapshot balance หลัง transaction
  created_at      TIMESTAMPTZ DEFAULT now(),
  created_by      BIGINT REFERENCES users(id)      -- null = system
);

CREATE INDEX IF NOT EXISTS idx_ledger_user ON coin_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_ref  ON coin_ledger(ref_type, ref_id);

-- ---- 6. MANGA_EP ----
CREATE TABLE IF NOT EXISTS manga_ep (
  ep_id              BIGSERIAL PRIMARY KEY,
  p_id               BIGINT NOT NULL REFERENCES cartoons(p_id) ON DELETE CASCADE,
  ep_name            TEXT NOT NULL,
  ep_no              INTEGER NOT NULL,
  ep_price           NUMERIC(10,2) NOT NULL DEFAULT 0,  -- 0 = ฟรี ห้ามใช้ FLOAT
  ep_content         TEXT,                         -- นิยายเก็บที่นี่ มังงะไม่ใช้
  total_image        INTEGER DEFAULT 0,
  image_protection   BOOLEAN DEFAULT false,
  publish_status     TEXT NOT NULL DEFAULT 'now' CHECK (publish_status IN ('now','schedule','hide')),
  schedule_datetime  TIMESTAMPTZ,                  -- ใช้เมื่อ publish_status = 'schedule'
  lock_duration_days INTEGER,                      -- null=ซื้อถาวร N=หมดอายุใน N วัน
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted')),
  created_by         BIGINT REFERENCES users(id),
  updated_by         BIGINT REFERENCES users(id),
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE(p_id, ep_no)
);

CREATE INDEX IF NOT EXISTS idx_manga_ep_p_id    ON manga_ep(p_id);
CREATE INDEX IF NOT EXISTS idx_manga_ep_publish ON manga_ep(p_id, publish_status, status);

-- ---- 7. MANGA_EP_IMAGES (manga เท่านั้น) ----
CREATE TABLE IF NOT EXISTS manga_ep_images (
  id          BIGSERIAL PRIMARY KEY,
  ep_id       BIGINT NOT NULL REFERENCES manga_ep(ep_id) ON DELETE CASCADE,
  p_id        BIGINT NOT NULL,
  ep_no       INTEGER NOT NULL,
  image_path  TEXT NOT NULL,                       -- path ใน R2/S3
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manga_images_ep ON manga_ep_images(ep_id);

-- ---- 8. EP_SHOP (ประวัติการซื้อตอน) ----
CREATE TABLE IF NOT EXISTS ep_shop (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             BIGINT NOT NULL REFERENCES users(id),
  ep_id               BIGINT NOT NULL REFERENCES manga_ep(ep_id),
  p_id                BIGINT NOT NULL,
  ep_no               INTEGER NOT NULL,
  price               NUMERIC(10,2) NOT NULL,       -- ห้ามใช้ FLOAT
  remain_point        BIGINT NOT NULL,              -- snapshot point หลังซื้อ
  ledger_id           BIGINT REFERENCES coin_ledger(id),
  lock_after_datetime TIMESTAMPTZ,                 -- null=ถาวร timestamp=หมดอายุ
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ⚠️ Critical index — ป้องกัน race condition ซื้อซ้ำ (เฉพาะกรณีถาวร)
-- Partial index predicate ต้องเป็น IMMUTABLE — now() เป็น STABLE ไม่ใช่ IMMUTABLE
-- ทำให้ "WHERE (... OR lock_after_datetime > now())" สร้าง index ไม่ได้เลย (Postgres
-- ปฏิเสธด้วย "functions in index predicate must be marked IMMUTABLE") กรณี "ยังไม่
-- หมดอายุ" (time-dependent, static index ครอบคลุมไม่ได้ในหลักการ) ป้องกันด้วย
-- pg_advisory_xact_lock ใน purchase.service.ts's purchaseEpisodes() แทน — ดู comment
-- ที่นั่น อินเด็กซ์นี้ยังคง unique-protect เฉพาะกรณีถาวรแบบ static ได้ตรงไปตรงมา
CREATE UNIQUE INDEX IF NOT EXISTS ep_shop_active_uniq
  ON ep_shop (user_id, ep_id)
  WHERE (lock_after_datetime IS NULL);

-- ---- 9. TOPUP_TRANSACTIONS ----
CREATE TABLE IF NOT EXISTS topup_transactions (
  id              BIGSERIAL PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id),
  package_id      BIGINT REFERENCES topup_packages(id),
  transaction_id  TEXT UNIQUE NOT NULL,            -- ID จาก payment provider
  ref_id          TEXT UNIQUE NOT NULL,            -- ref ภายใน (TP + timestamp + random)
  payment_method  TEXT NOT NULL CHECK (payment_method IN ('promptpay','truemoney')),
  amount_paid     NUMERIC(12,2) NOT NULL,          -- ห้ามใช้ FLOAT
  coins_added     BIGINT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','cancelled')),
  idempotency_key TEXT UNIQUE,                     -- ป้องกัน double-credit จาก webhook retry
  raw_webhook     JSONB,                           -- เก็บ raw payload จาก provider ไว้ debug
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_topup_user           ON topup_transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_topup_transaction_id ON topup_transactions(transaction_id);

-- ---- 10. WITHDRAWALS ----
CREATE TABLE IF NOT EXISTS withdrawals (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id),
  amount      NUMERIC(12,2) NOT NULL,              -- ยอดที่ขอถอน ห้ามใช้ FLOAT
  fee_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  rate        NUMERIC(10,4) NOT NULL DEFAULT 1,    -- อัตราแลกเปลี่ยน sales → บาท
  net_amount  NUMERIC(12,2) NOT NULL,              -- ยอดจริงที่ได้รับ
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reason      TEXT,                                -- เหตุผลที่ reject (ถ้ามี)
  approved_by BIGINT REFERENCES users(id),         -- admin ที่ approve
  approved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id, status);

-- ---- 11. USER_DETAIL (ข้อมูล writer สำหรับถอนเงิน) ----
CREATE TABLE IF NOT EXISTS user_detail (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users(id),
  user_prefix   TEXT NOT NULL,
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  user_phone    TEXT NOT NULL,
  bank_name     TEXT NOT NULL,
  bank_number   TEXT,
  bank_type     TEXT,
  bank_image    TEXT,
  fan_page_link TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approve','rejected')),
  reject_reason TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ---- 12. USER_BANS ----
CREATE TABLE IF NOT EXISTS user_bans (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id),
  reason      TEXT NOT NULL,
  unbanned_at TIMESTAMPTZ,                         -- null = แบนถาวร
  banned_by   BIGINT REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_bans_user ON user_bans(user_id);

-- ---- 13. MANGA_EP_VIEWS ----
CREATE TABLE IF NOT EXISTS manga_ep_views (
  id         BIGSERIAL PRIMARY KEY,
  p_id       BIGINT NOT NULL REFERENCES cartoons(p_id),
  ep_no      INTEGER NOT NULL,
  user_id    BIGINT REFERENCES users(id),          -- null = guest
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_views_p_id ON manga_ep_views(p_id);
CREATE INDEX IF NOT EXISTS idx_views_user ON manga_ep_views(user_id) WHERE user_id IS NOT NULL;

-- ---- 14. MANGA_FAVORITE ----
CREATE TABLE IF NOT EXISTS manga_favorite (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id),
  p_id       BIGINT NOT NULL REFERENCES cartoons(p_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, p_id)
);

-- ---- 15. USER_FOLLOWERS ----
CREATE TABLE IF NOT EXISTS user_followers (
  follower_id  BIGINT NOT NULL REFERENCES users(id),
  following_id BIGINT NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

-- ---- 16. CARTOON_COMMENTS ----
CREATE TABLE IF NOT EXISTS cartoon_comments (
  id          BIGSERIAL PRIMARY KEY,
  cartoon_id  BIGINT NOT NULL REFERENCES cartoons(p_id),
  episode_id  BIGINT REFERENCES manga_ep(ep_id),
  user_id     BIGINT NOT NULL REFERENCES users(id),
  parent_id   BIGINT REFERENCES cartoon_comments(id), -- null = comment หลัก
  content     TEXT NOT NULL,
  likes_count INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','deleted')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_cartoon ON cartoon_comments(cartoon_id, status);
CREATE INDEX IF NOT EXISTS idx_comments_parent  ON cartoon_comments(parent_id) WHERE parent_id IS NOT NULL;

-- ---- 17. COMMENT_LIKES ----
CREATE TABLE IF NOT EXISTS comment_likes (
  id         BIGSERIAL PRIMARY KEY,
  comment_id BIGINT NOT NULL REFERENCES cartoon_comments(id),
  user_id    BIGINT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

-- ---- 18. NOTIFICATIONS ----
CREATE TABLE IF NOT EXISTS notifications (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users(id),
  type       TEXT NOT NULL CHECK (type IN ('comment','reply','system')),
  message    TEXT NOT NULL,
  ref_url    TEXT,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- ---- 19. AUDIT_LOGS ----
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT REFERENCES users(id),         -- null = system
  event_type  TEXT NOT NULL,                       -- เช่น 'user.ban', 'withdrawal.approve'
  description TEXT,
  metadata    JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_user  ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_logs(event_type);

-- ---- 20. ANNOUNCEMENTS ----
CREATE TABLE IF NOT EXISTS announcements (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_by  BIGINT REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ---- 21. CAROUSELS ----
CREATE TABLE IF NOT EXISTS carousels (
  id          BIGSERIAL PRIMARY KEY,
  title       TEXT,
  image_path  TEXT NOT NULL,
  link_url    TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ---- 22. WEB_SETTING ----
CREATE TABLE IF NOT EXISTS web_setting (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO web_setting VALUES
  ('topup',         'true'),
  ('exchange_rate', '1'),
  ('withdraw_min',  '100'),
  ('withdraw_fee',  '0'),
  ('coin_nickname', 'เหรียญ'),
  ('site_name',     'Novel Platform')
ON CONFLICT (key) DO NOTHING;

-- ---- 23. WEB_CONTACTS ----
CREATE TABLE IF NOT EXISTS web_contacts (
  id         BIGSERIAL PRIMARY KEY,
  label      TEXT NOT NULL,
  url        TEXT NOT NULL,
  icon_class TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);