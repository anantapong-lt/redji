// =============================================================
// Novel Platform — Kysely Database Types
// ไฟล์นี้ต้องตรงกับ 001_init.sql + 002_novel_blocks.sql + 003_referral.sql เสมอ
// Table renames: cartoons→works, manga_ep→work_ep, manga_ep_images→work_ep_image (เดิมเปลี่ยนไม่ครบ
//                เป็น cartoon_ep_image ก่อน — migration 006 แก้ให้ตรงกันแล้ว)
//                manga_ep_views→work_ep_views, manga_favorite→work_favorite
// วางไว้ที่: apps/api/src/db/types.ts
// =============================================================

import type { Generated, ColumnType } from 'kysely'

// Decimal columns — PostgreSQL NUMERIC(x,y) → string ใน JS เพื่อป้องกัน float precision loss
type Decimal = ColumnType<string, string, string>

// =============================================================
// Novel Block Types
// ใช้เป็น type ของ ep_content JSONB ใน WorkEpTable
// =============================================================

// Style ระดับ block — ใช้กับทั้ง block (เช่น block นี้ทั้งก้อนเป็น bold)
export interface NovelBlockStyle {
  bold?:      boolean
  italic?:    boolean
  underline?: boolean
  color?:     string   // hex เช่น "#c0392b" หรือ null = ใช้ default
}

// Timestamp สำหรับ TTS Spotify-style
// start/end = วินาทีใน audio file ของตอนนั้น
// null = ยังไม่มี audio render (ส่วนใหญ่จะเป็น null ในตอนนี้)
export interface NovelBlockAudioTs {
  start: number   // เช่น 14.3
  end:   number   // เช่น 16.8
}

// Block หนึ่งชิ้น — unit เล็กที่สุดของนิยาย
// display_label convention (เรื่องแสดงผลล้วนๆ — ไม่เกี่ยวกับ TTS เลย ดู Tier1_DesignCore.md ข้อ 1/3):
//   "paragraph"        — ย่อหน้าทั่วไป
//   "narration"        — คำบรรยายของผู้เล่าเรื่อง
//   "dialogue"         — บทพูด ไม่ระบุตัวละคร
//   "dialogue:ชื่อ"    — บทพูดของตัวละครที่ระบุ
//   "action"           — ฉาก action / บรรยายการกระทำ
//   "heading"          — หัวข้อฉาก / บท
// TTS-only metadata is optional so every existing reader block remains valid.
// `text` is always the clean reader-facing copy; `tts_text` can contain editor
// directives such as //1 or {pause:1.5} that never render in the reader.
// เดิม field ชื่อ "label"/"kind" เฉยๆ เปลี่ยนชื่อ 2026-08-16 ตาม Tier1_DesignCore.md เพื่อแยก
// concern แสดงผล (display_label) ออกจาก concern TTS (tts.block_kind) เด็ดขาด — ของเก่าที่ยังไม่ได้
// resave จะยังมี key เดิม (label/kind) ค้างอยู่ใน DB จริง โค้ดที่อ่าน ep_content ต้อง fallback เอง
// (ดู normalizeStoredNovelBlock ใน tts-editor.service.ts) getTtsSourceHash() จงใจไม่ตามการเปลี่ยนนี้
// เพื่อไม่ให้ source_hash ของตอนเก่าที่มีเสียงอยู่แล้วเปลี่ยนไป (ดูคอมเมนต์ใน tts.service.ts)
export interface NovelBlockTts {
  block_kind?: 'narration' | 'gap'
  gap_seconds?: number
  skip?: boolean
  speaker_slot?: number
  emotion?: 'neutral' | 'sad' | 'angry' | 'happy' | 'excited' | 'fear' // aspirational — ดู Tier1_DesignCore.md ข้อ 5, TTS Core ยังไม่ใช้งานจริง
}

export interface NovelBlock {
  id:       string                   // "block_1", "block_2" ... unique ภายใน episode
  display_label: string              // ดูด้านบน — free-form string, เรื่องแสดงผลอย่างเดียว
  text:     string                   // เนื้อหาจริง
  style:    NovelBlockStyle | null   // null = ใช้ default style
  audio_ts: NovelBlockAudioTs | null // null = ยังไม่มี audio
  tts_text?: string
  tts?: NovelBlockTts
}

// =============================================================
// Table Interfaces
// =============================================================

// ---- CATEGORIES ----
export interface CategoriesTable {
  id:         Generated<bigint>
  name:       string
  status:     boolean
  created_at: Generated<Date>
  icon:       string | null  // migration 049 — emoji โชว์บนแคโรเซลหน้าแรก (เดิม hardcode ผูกกับชื่อ)
}

// ---- USERS ----
export interface UsersTable {
  id:               Generated<bigint>
  uuid:             string
  u_name:           string
  display_name:     string
  email:            string
  password_hash:    string
  level:            number                         // 1=user (2-5 ว่างไว้เผื่ออนาคต), 6=writer, 7=นักเขียนของเว็บ,
                                                     // 8=แอดมินย่อย, 9=แอดมินรอง, 10=shareholder
  point:            ColumnType<bigint, never, never>  // READ ONLY — ต้องผ่าน coin_ledger เท่านั้น
  sales:            ColumnType<bigint, never, never>  // READ ONLY — ต้องผ่าน coin_ledger เท่านั้น
  user_img:         string | null
  google_id:        string | null
  google_token:     string | null                  // ต้องซ่อนใน response เสมอ
  social_media: {
    facebook?:  string
    twitter?:   string
    instagram?: string
    [key: string]: string | undefined
  } | null
  bio:              string | null                 // migration 018 — "แนะนำตัว"
  // location ถูกตัดออกแล้ว (migration 019 — user ขอตัดทิ้ง)
  bookmarks_public: Generated<boolean>             // migration 022 — โชว์/ซ่อนแท็บบุ๊คมาร์คจากคนอื่น (default โชว์)
  auto_ep_purchase: ColumnType<boolean, boolean | undefined, boolean>
  load_all_images:  ColumnType<boolean, boolean | undefined, boolean>
  password_legacy:  ColumnType<boolean, boolean | undefined, boolean>  // true = force reset ครั้งถัดไป
  // --- migration 003: Referral System ---
  referral_code:    string | null                  // code ของ writer (auto-gen ตอน approve เป็น writer)
  referred_by:      bigint | null                  // user.id ของคนที่ชวนมาสมัคร
  writer_tier:      ColumnType<'pioneer' | 'standard', 'pioneer' | 'standard' | undefined, 'pioneer' | 'standard'>
  withdrawal_rate:  Decimal | null                 // NULL = ใช้ WITHDRAWAL_RATE จาก .env, มีค่า = override เฉพาะ user นี้
  // --- migration 031: บัญชีธนาคารสำหรับถอนเงิน (null = ยังไม่เคยตั้ง ต้องส่ง bank_change_requests ก่อน) ---
  bank_code:           string | null
  bank_account_name:   string | null
  bank_account_number: string | null
  created_at:       Generated<Date>
  updated_at:       Generated<Date>
  // --- migration 027: ลบบัญชีถาวร (anonymize) ---
  deleted_at:       Date | null
  deleted_by:       bigint | null
  deletion_reason:  string | null
  // --- migration 046: "หน่วยรบ" (admin/squad) ---
  created_by_admin_id: bigint | null                // ใครสร้างบัญชีนี้ (level 9 สร้าง 8, level 10 สร้าง 9) NULL = สมัครเอง
  squad_monthly_quota: number | null                 // โควตาสร้าง level 8/เดือนของ admin level 9 คนนี้ NULL = ใช้ค่า default กลาง
}

// ---- WORKS ----
export interface WorksTable {
  p_id:              Generated<bigint>
  uuid:              string
  title:             string
  original_title:    string | null                  // migration 004: "ชื่อเรื่องต้นฉบับ" ในหน้า Editor
  description:       string | null
  synopsis:          object | null                   // migration 008: "เรื่องย่อ" rich text (Tiptap JSON) — คนละ field กับ "คำโปรย"/description
  cover_image:       string | null                 // path ใน R2/S3
  author_id:         bigint
  category_main:     bigint | null
  category_sub:      bigint | null
  type:              'manga' | 'novel'
  origin_type:       1 | 2 | 3 | 4 | null         // 1=ไทย 2=ญี่ปุ่น 3=เกาหลี 4=จีน
  age_rate:          'all' | '18+' | null          // migration 004: ลดจาก 4 ระดับเหลือ 2
  is_translated:     ColumnType<boolean, boolean | undefined, boolean> // migration 004: นิยายแปล (true) / แต่งเอง (false) — คนละมิติกับ origin_type
  tags:              string[]                      // migration 004: หมวดหมู่เสริม (free tag, ไม่ผูกกับ categories) — migration 030: หมวดหมู่ย่อยพิเศษ (BL/GL) เก็บเป็น string ธรรมดาในนี้ด้วย ไม่มี column แยก
  is_one_shot:       ColumnType<boolean, boolean | undefined, boolean> // migration 005: จบในตอนเดียว — สร้างตอนที่ 2 ไม่ได้เลย (บังคับใน createEpisode)
  featured:          Generated<boolean>              // migration 021: นักเขียนปักหมุดเอง โชว์ในแท็บ "แนะนำ" หน้าโปรไฟล์ (สูงสุด 8 เรื่อง)
  publish_status:    0 | 1                         // 0=ซ่อน 1=เผยแพร่
  completion_status: 'ongoing' | 'completed' | 'hiatus' | null
  episode_label:     string | null                 // migration 010: "คำเรียกตอน" เช่น "ตอนที่", "บทที่" — จำต่อทุกตอนในเรื่องนี้ null=ไม่มีคำนำหน้า
  status:            'active' | 'deleted'
  banned: {
    banned_at:   string
    banned_by:   number
    reason:      string
    admin_name?: string
  } | null
  view_count:  Generated<bigint>
  created_by:  bigint | null
  updated_by:  bigint | null
  deleted_at:  Date | null
  deleted_by:  bigint | null
  created_at:  Generated<Date>
  updated_at:  Generated<Date>
}

// ---- TOPUP_PACKAGES ----
export interface TopupPackagesTable {
  id:          Generated<bigint>
  coin_amount: bigint
  bonus:       bigint
  price:       Decimal
  status:      'show' | 'hide'
  created_at:  Generated<Date>
  updated_at:  Generated<Date>
}

// ---- COIN_LEDGER (append-only — ห้าม UPDATE/DELETE เด็ดขาด) ----
export interface CoinLedgerTable {
  id:              Generated<bigint>
  user_id:         bigint
  delta:           bigint                          // + เติม, - ซื้อ/ถอน
  reason:          'topup' | 'purchase' | 'refund' | 'admin_adjust' | 'withdrawal' | 'redeem_code'
  ref_type:        'topup_transaction' | 'ep_shop' | 'withdrawal' | 'redeem_code_use' | null
  ref_id:          bigint | null
  idempotency_key: string
  balance_after:   bigint
  created_at:      Generated<Date>
  created_by:      bigint | null
}

// ---- WORK_EP ----
export interface WorkEpTable {
  ep_id:             Generated<bigint>
  p_id:              bigint
  ep_name:           string
  ep_no:             number
  ep_price:          Decimal                       // 0 = ฟรี
  // novel → NovelBlock[] (JSONB array)
  // manga → null (ภาพอยู่ใน work_ep_image แทน)
  ep_content:        NovelBlock[] | null
  total_image:       number
  image_protection:  boolean
  reader_message:    string | null                 // migration 011: "ข้อความถึงนักอ่าน"
  episode_label:     string | null                 // migration 014: "คำเรียกตอน" ต่อตอน (ย้ายมาจาก works.episode_label)
  publish_status:    'now' | 'schedule' | 'hide'
  schedule_datetime: Date | null
  lock_duration_days: number | null                // null=ถาวร N=หมดอายุใน N วัน
  status:            'active' | 'deleted'
  created_by:        bigint | null
  updated_by:        bigint | null
  created_at:        Generated<Date>
  updated_at:        Generated<Date>
}

// ---- WORK_EP_IMAGE ----
export interface WorkEpImageTable {
  id:         Generated<bigint>
  ep_id:      bigint
  p_id:       bigint
  ep_no:      number
  image_path: string
  sort_order: number
  created_at: Generated<Date>
}

// ---- EP_SHOP ----
export interface EpShopTable {
  id:                  Generated<bigint>
  user_id:             bigint
  ep_id:               bigint
  p_id:                bigint
  ep_no:               number
  price:               Decimal
  remain_point:        bigint
  ledger_id:           bigint | null
  lock_after_datetime: Date | null                 // null=ถาวร
  created_at:          Generated<Date>
}

// ---- TOPUP_TRANSACTIONS ----
export interface TopupTransactionsTable {
  id:              Generated<bigint>
  user_id:         bigint
  package_id:      bigint | null
  transaction_id:  string
  ref_id:          string
  payment_method:  'promptpay' | 'truemoney'
  amount_paid:     Decimal
  coins_added:     bigint
  status:          'pending' | 'completed' | 'failed' | 'cancelled'
  idempotency_key: string | null
  raw_webhook:     unknown | null
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

// ---- WITHDRAWALS ----
// migration 031: เลิกใช้ fee_percent/rate (แนวคิดเดิม "ถอนทั้งก้อน sales*rate ครั้งเดียว") —
// ตอนนี้ผู้เขียนพิมพ์ amount เอง (500-50,000 บาท) + fee_amount คงที่ (20 บาท ถ้าเกินโควตาฟรี
// 2 ครั้ง/เดือน) + snapshot บัญชีธนาคาร ณ ตอนขอถอน (bank_code/account_name/account_number)
export interface WithdrawalsTable {
  id:             Generated<bigint>
  user_id:        bigint
  amount:         Decimal                          // จำนวนที่ขอถอน (ก่อนหักค่าธรรมเนียม)
  fee_amount:     Decimal                           // ค่าธรรมเนียมคงที่ (0 หรือ 20)
  net_amount:     Decimal                           // ยอดจริงที่ได้รับ = amount - fee_amount
  bank_code:      string                            // snapshot ธนาคาร ณ ตอนขอถอน
  account_name:   string
  account_number: string
  status:         'pending' | 'approved' | 'rejected'
  reason:         string | null
  approved_by:    bigint | null                      // บัญชีระบบที่กดอนุมัติ (อาจถูกใช้ร่วมกันหลายคน)
  approved_at:    Date | null
  transfer_proof_url: string | null                  // migration 033: สลิปโอนเงินจริง แนบตอนอนุมัติ
  transferred_by_name: string | null                 // migration 034: ชื่อคนจริงที่พิมพ์เองตอนอนุมัติ (แยกจาก approved_by)
  created_at:     Generated<Date>
  updated_at:     Generated<Date>
}

// ---- BANK_CHANGE_REQUESTS (migration 031) ----
// คำขอตั้ง/เปลี่ยนบัญชีธนาคารของนักเขียน — ต้องแนบหลักฐาน รอแอดมินอนุมัติก่อนเข้าไปอัปเดต
// users.bank_* จริง (แพทเทิร์น review เดียวกับ admin_action_requests — migration 024)
export interface BankChangeRequestsTable {
  id:             Generated<bigint>
  user_id:        bigint
  bank_code:      string
  account_name:   string
  account_number: string
  reason:         string | null
  document_url:   string                            // ภาพสมุดบัญชี+บัตรประชาชน (R2)
  status:         'pending' | 'approved' | 'rejected'
  review_note:    string | null
  reviewed_by:    bigint | null
  reviewed_at:    Date | null
  created_at:     Generated<Date>
  updated_at:     Generated<Date>
}

// ---- USER_DETAIL ----
export interface UserDetailTable {
  id:           Generated<bigint>
  user_id:      bigint
  user_prefix:  string
  first_name:   string
  last_name:    string
  user_phone:   string
  national_id:  string | null
  id_address:          string | null
  id_province:         string | null
  id_district:         string | null
  id_subdistrict:      string | null
  id_postal_code:      string | null
  current_address:     string | null
  current_province:    string | null
  current_district:    string | null
  current_subdistrict: string | null
  current_postal_code: string | null
  bank_name:    string
  bank_branch:  string | null
  bank_number:  string | null
  bank_type:    string | null
  bank_image:   string | null
  fan_page_link: string | null
  status:       'pending' | 'approve' | 'rejected'
  application_type: 'new_writer' | 'edit'   // migration 056 — new_writer เลื่อน level ตอนอนุมัติ, edit ไม่แตะ level
  reject_reason: string | null
  created_at:   Generated<Date>
  updated_at:   Generated<Date>
}

// ---- ADMIN_ACTION_REQUESTS ----
// 2 ระบบอนุมัติ: ban_user (level 8 ขอ, level>=9 อนุมัติ), promote_level_8 (level 9 ขอ, level>=10 อนุมัติ)
export interface AdminActionRequestsTable {
  id:             Generated<bigint>
  request_type:   'ban_user' | 'promote_level_8'
  requested_by:   bigint
  target_user_id: bigint
  reason:         string
  status:         ColumnType<'pending' | 'approved' | 'rejected', 'pending' | 'approved' | 'rejected' | undefined, 'pending' | 'approved' | 'rejected'>
  reviewed_by:    bigint | null
  review_note:    string | null
  created_at:     Generated<Date>
  reviewed_at:    Date | null
}

// ---- CONTENT_REPORTS (migration 025, +หมวดหมู่/routing migration 032) ----
export interface ContentReportsTable {
  id:                     Generated<bigint>
  target_type:            'comment' | 'work' | 'user'
  target_id:              bigint
  reported_by:            bigint
  reason:                 string
  status:                 ColumnType<'pending' | 'resolved' | 'dismissed', 'pending' | 'resolved' | 'dismissed' | undefined, 'pending' | 'resolved' | 'dismissed'>
  reviewed_by:            bigint | null
  review_note:            string | null
  created_at:             Generated<Date>
  reviewed_at:            Date | null
  // --- migration 032: หมวดหมู่รายงาน + routing เข้านักเขียน (เฉพาะ category='content_error') ---
  category:                ReportCategory | null   // NULL = รายงานเก่าก่อน migration นี้ ไม่เคยมีหมวดหมู่
  work_author_id:          bigint | null            // snapshot เจ้าของผลงาน ณ ตอนรายงาน (ทั้ง target_type='work' และ 'comment')
  writer_note:             string | null            // นักเขียนตอบกลับสั้นๆ — แอดมินเห็นในคิวเดิมด้วย
  writer_acknowledged_at:  Date | null
}

// รายชื่อหมวดหมู่รายงาน — ตรงกับ CHECK constraint ใน migration 032 และ apps/api/src/lib/report-categories.ts
export type ReportCategory =
  | 'content_error'
  | 'copyright'
  | 'unrated_18plus'
  | 'inappropriate'
  | 'scam'
  | 'spam'
  | 'impersonation'
  | 'harassment'
  | 'general'
  | 'other'

// ---- WRITER_ADMIN_NOTICES (migration 032) ----
// แอดมินส่งรายงาน/แจ้งเตือนถึงนักเขียนเจ้าของผลงานตรงๆ (ส่งจากหน้าจัดการผลงานฝั่งแอดมิน) —
// คนละเรื่องกับ content_reports ที่มาจากนักอ่าน
export interface WriterAdminNoticesTable {
  id:                     Generated<bigint>
  work_id:                bigint | null
  writer_id:              bigint
  admin_id:               bigint | null
  message:                string
  // migration 042 — กล่องข้อความ/เหตุการณ์สำหรับนักเขียน
  subject:                string | null
  severity:               ColumnType<'normal' | 'risk' | 'critical', 'normal' | 'risk' | 'critical' | undefined, 'normal' | 'risk' | 'critical'>
  source:                 ColumnType<'work_notice' | 'admin_message' | 'system_action', 'work_notice' | 'admin_message' | 'system_action' | undefined, 'work_notice' | 'admin_message' | 'system_action'>
  metadata:               unknown
  writer_note:            string | null
  writer_acknowledged_at: Date | null
  created_at:             Generated<Date>
  updated_at:             Generated<Date>
}

// ---- LOGIN_HISTORY (migration 026) — โครงเปล่าๆ เก็บ raw data ก่อน ยังไม่มีหน้าดู ----
export interface LoginHistoryTable {
  id:         Generated<bigint>
  user_id:    bigint | null
  identifier: string
  success:    boolean
  ip_address: string | null
  user_agent: string | null
  created_at: Generated<Date>
}

// ---- USER_BANS ----
export interface UserBansTable {
  id:          Generated<bigint>
  user_id:     bigint
  reason:      string
  unbanned_at: Date | null                         // null = แบนถาวร
  banned_by:   bigint | null
  created_at:  Generated<Date>
  updated_at:  Generated<Date>
}

// ---- USER_ACTIVITY_SUSPENSIONS (migration 027) — "ระงับการเคลื่อนไหว" ----
export interface UserActivitySuspensionsTable {
  id:           Generated<bigint>
  user_id:      bigint
  reason:       string
  suspended_by: bigint
  lifted_at:    Date | null                        // null = ยังระงับอยู่
  created_at:   Generated<Date>
}

// ---- USER_SPEND_SUSPENSIONS (migration 027) — "ระงับการใช้จ่าย+เติมเงิน" ----
export interface UserSpendSuspensionsTable {
  id:           Generated<bigint>
  user_id:      bigint
  reason:       string
  suspended_by: bigint
  lifted_at:    Date | null
  created_at:   Generated<Date>
}

// ---- ADMIN_USER_FLAGS (migration 027) — ระบบ flag ของ level 8 + consensus threshold ----
export interface AdminUserFlagsTable {
  id:             Generated<bigint>
  target_user_id: bigint
  action_type:    'suspend_activity' | 'suspend_spending' | 'ban' | 'delete'
  flagged_by:     bigint
  reason:         string
  status:         ColumnType<
    'pending' | 'auto_executed' | 'executed' | 'dismissed',
    'pending' | 'auto_executed' | 'executed' | 'dismissed' | undefined,
    'pending' | 'auto_executed' | 'executed' | 'dismissed'
  >
  reviewed_by:    bigint | null
  review_note:    string | null
  created_at:     Generated<Date>
  reviewed_at:    Date | null
}

// ---- WORK_EP_VIEWS ----
export interface WorkEpViewsTable {
  id:         Generated<bigint>
  p_id:       bigint
  ep_no:      number
  user_id:    bigint | null                        // null = guest
  ip_address: string | null
  created_at: Generated<Date>
}

// ---- WORK_FAVORITE ---- ("หัวใจ" — แค่บอกว่าชอบ ไม่ใช่เก็บไว้อ่านทีหลัง ดู WorkBookmarksTable)
export interface WorkFavoriteTable {
  id:         Generated<bigint>
  user_id:    bigint
  p_id:       bigint
  created_at: Generated<Date>
}

// ---- WORK_BOOKMARKS ---- ("เก็บเข้าคลัง" — migration 009, แยกจาก work_favorite ตั้งใจ)
export interface WorkBookmarksTable {
  id:         Generated<bigint>
  user_id:    bigint
  p_id:       bigint
  created_at: Generated<Date>
  featured:   Generated<boolean> // migration 022 — "นิยายแนะนำ" ที่นักอ่านปักหมุดเอง (โปรไฟล์ที่ไม่ใช่นักเขียน)
}

// ---- WORK_EP_BOOKMARKS ---- (migration 023 — "เก็บตอนโปรดไว้ดูทีหลัง" แยกจาก work_bookmarks ที่เก็บทั้งเรื่อง)
export interface WorkEpBookmarksTable {
  id:         Generated<bigint>
  user_id:    bigint
  ep_id:      bigint
  created_at: Generated<Date>
}

// ---- USER_FOLLOWERS ----
export interface UserFollowersTable {
  follower_id:  bigint
  following_id: bigint
  created_at:   Generated<Date>
}

// ---- WORK_COMMENTS ----
export interface WorkCommentsTable {
  id:          Generated<bigint>
  work_id:     bigint
  episode_id:  bigint | null
  user_id:     bigint
  parent_id:   bigint | null                       // null = comment หลัก
  content:     string
  likes_count: number
  status:      'active' | 'deleted'
  created_at:  Generated<Date>
  updated_at:  Generated<Date>
}

// ---- COMMENT_LIKES ----
export interface CommentLikesTable {
  id:         Generated<bigint>
  comment_id: bigint
  user_id:    bigint
  created_at: Generated<Date>
}

// ---- NOTIFICATIONS ----
export interface NotificationsTable {
  id:         Generated<bigint>
  user_id:    bigint
  type:       'comment' | 'reply' | 'system'
  message:    string
  ref_url:    string | null
  is_read:    boolean
  created_at: Generated<Date>
}

// ---- AUDIT_LOGS ----
export interface AuditLogsTable {
  id:          Generated<bigint>
  user_id:     bigint | null                       // null = system action
  event_type:  string
  description: string | null
  metadata:    unknown | null
  ip_address:  string | null
  user_agent:  string | null
  created_at:  Generated<Date>
}

// ---- ANNOUNCEMENTS ----
export interface AnnouncementsTable {
  id:         Generated<bigint>
  title:      string
  content:    string
  status:     'active' | 'inactive'
  color:      Generated<'green' | 'red' | 'purple' | 'gold'>
  created_by: bigint | null
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

// ---- CAROUSELS ----
export interface CarouselsTable {
  id:              Generated<bigint>
  title:           string | null
  subtitle:        string | null  // migration 012
  image_path:      string
  link_url:        string | null
  sort_order:      number
  status:          'active' | 'inactive'
  // migration 028 — ตั้งเวลาเผยแพร่/สิ้นสุด (end_at null = ไม่มีกำหนด) + เวลาที่แสดงก่อนเปลี่ยน
  // สไลด์ (วินาที ใส่ทศนิยมได้) + หมายเหตุภายใน (ไม่โชว์ฝั่งสาธารณะ ต่างจาก subtitle)
  start_at:        ColumnType<Date, Date | string | undefined, Date | string>
  end_at:          Date | null
  display_seconds: ColumnType<string, string | number | undefined, string | number>
  note:            string | null
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

// ---- FEATURED_WORKS (migration 028) ----
// ระบบ "นิยายแนะนำแบบ Cheesy" — แอดมินเลือกผลงานมาบูสต์ให้ไปปนอยู่ในแถวหน้าแรก 1 ใน 3 แถว
// section ตรงกับค่า sort ของ GET /works ที่ 3 แถวหน้าแรกใช้อยู่แล้วเป๊ะ (sales/popular/latest)
export interface FeaturedWorksTable {
  id:         Generated<bigint>
  p_id:       bigint
  section:    'sales' | 'popular' | 'latest'
  sort_order: number
  expires_at: Date
  created_by: bigint
  created_at: Generated<Date>
}

// ---- WEB_SETTING ----
export interface WebSettingTable {
  key:        string
  value:      string
  updated_at: Generated<Date>
}

// ---- WEB_CONTACTS ----
export interface WebContactsTable {
  id:         Generated<bigint>
  label:      string
  url:        string
  icon_class: string | null
  sort_order: number  // migration 054
  status:     boolean // migration 054 — true = แสดง, false = ซ่อน
  created_at: Generated<Date>
}

// ---- FAQS ---- (migration 054 — หน้า "ติดต่อแอดมิน")
export interface FaqsTable {
  id:         Generated<bigint>
  question:   string
  answer:     string
  sort_order: number
  status:     boolean
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

// ---- PASSWORD_RESET_TOKENS ----
export interface PasswordResetTokensTable {
  id:         Generated<bigint>
  user_id:    bigint
  token:      string
  expires_at: Date
  used_at:    Date | null
  created_at: Generated<Date>
}

// ---- NOVEL_BLOCK_REPORTS ----
// user รายงานว่า block ไหนใน episode มีข้อผิดพลาด
// block_id อ้างอิงไปที่ NovelBlock.id ใน manga_ep.ep_content (JSONB)
export interface NovelBlockReportsTable {
  id:         Generated<bigint>
  ep_id:      bigint
  block_id:   string                               // "block_3" — อ้างอิง NovelBlock.id
  user_id:    bigint
  reason:     string
  status:     'pending' | 'resolved' | 'dismissed'
  created_at: Generated<Date>
}

// ---- EPISODE_UPLOAD_JOBS ---- (migration 013 — "เพิ่มอัตโนมัติ" bulk-upload ผ่าน zip)
export interface EpisodeUploadJobsTable {
  id:            Generated<bigint>
  p_id:          bigint
  user_id:       bigint
  status:        'processing' | 'completed' | 'failed'
  total:         number
  processed:     number
  failed_files:  unknown  // JSONB: {filename: string, reason: string}[] — JSON.stringify ตอน insert/update
  succeeded_files: unknown  // JSONB: {filename: string, ep_no: number, ep_name: string}[] — migration 045
  error_message: string | null  // migration 016 — เหตุผลตอน status='failed' (error นอก per-file try/catch)
  created_at:    Generated<Date>
  updated_at:    Generated<Date>
}

// ---- ADMIN_NOVEL_UPLOAD_JOBS ---- (migration 044)
// "เพิ่มนิยายหลายเรื่อง" ฝั่งแอดมิน — คนละหน่วยความคืบหน้ากับ EpisodeUploadJobsTable ข้างบน
// (นับ "นิยาย" ทั้งเรื่อง ไม่ใช่ "ไฟล์ตอน" ในนิยายเรื่องเดียว)
export interface AdminNovelUploadJobsTable {
  id:              Generated<bigint>
  admin_id:        bigint
  target_user_id:  bigint
  status:          'processing' | 'completed' | 'failed'
  total:           number
  processed:       number
  failed_items:    unknown  // JSONB: {folder_name: string, reason: string}[]
  created_works:   unknown  // JSONB: {uuid: string, title: string}[]
  error_message:   string | null
  created_at:      Generated<Date>
  updated_at:      Generated<Date>
}

// ---- REFERRAL_CODE_REQUESTS ----
// writer ขอ custom referral code → admin approve/reject
export interface ReferralCodeRequestsTable {
  id:             Generated<bigint>
  user_id:        bigint                           // writer ที่ขอ
  requested:      string                           // code ที่อยากได้ (a-z, 0-9, 4-20 ตัว)
  status:         ColumnType<'pending' | 'approved' | 'rejected', 'pending' | 'approved' | 'rejected' | undefined, 'pending' | 'approved' | 'rejected'>
  reviewed_by:    bigint | null                    // admin ที่ review
  reject_reason:  string | null
  created_at:     Generated<Date>
  updated_at:     Generated<Date>
}

// ---- WRITER_REFERRAL_LINKS ----
// ความสัมพันธ์ writer A ชวน writer B มาเป็นนักเขียน
// referrer_id = A (คนชวน), writer_id = B (คนถูกชวน)
export interface WriterReferralLinksTable {
  id:                Generated<bigint>
  referrer_id:       bigint                        // writer ที่ชวน
  writer_id:         bigint                        // writer ที่ถูกชวน
  bonus_rate:        Decimal                       // ส่วนแบ่ง bonus ของ referrer_id (default 0.01 = 1%)
  is_active:         ColumnType<boolean, boolean | undefined, boolean>
  created_at:        Generated<Date>
}

// ---- TAGS ---- (migration 017 — registry คู่ขนานกับ works.tags array เดิม)
// works.tags (TEXT[]) ยังเป็น source of truth สำหรับแสดงผล/กรองค้นหา — ตารางนี้ track แค่
// เมื่อไหร่/ใครสร้าง tag ไหน สำหรับเช็คโควต้าสร้าง tag ใหม่รายเดือน (ดู syncWorkTags())
export interface TagsTable {
  id:         Generated<bigint>
  name:       string
  created_by: bigint
  created_at: Generated<Date>
}

// ---- WORK_TAGS ---- (migration 017)
// เชื่อม work ↔ tag พร้อม author_id (denormalize จาก works.author_id ตอนเขียน กันต้อง join
// เพิ่มตอนนับ distinct นักเขียนต่อ tag) ใช้ตอนแนะนำ tag (count) และตอนลบ tag ที่ไม่มีคนใช้
export interface WorkTagsTable {
  p_id:       bigint
  tag_id:     bigint
  author_id:  bigint
  created_at: Generated<Date>
}

// ---- USER_SOCIAL_LINKS ---- (migration 019)
// ช่องทางโซเชียล/เว็บไซต์ของ user แบบเพิ่มได้หลายอัน (สูงสุด 4 — บังคับที่ระดับ service ไม่ใช่ DB
// constraint) แทนที่ social_media.website เดิม (เก็บได้แค่อันเดียว) — ดู setSocialLinks()
export interface UserSocialLinksTable {
  id:         Generated<bigint>
  user_id:    bigint
  url:        string
  label:      string | null
  sort_order: number
  created_at: Generated<Date>
}

// ---- PERMISSION_ACTIONS ---- (migration 047 — แคตตาล็อก action ที่ปรับสิทธิ์ได้)
export interface PermissionActionsTable {
  key:         string
  category:    string
  label:       string
  description: string | null
  sort_order:  number
}

// ---- PERMISSION_MATRIX ---- (migration 047 — action_key × level(8/9/10) → allowed)
export interface PermissionMatrixTable {
  action_key: string
  level:      number
  allowed:    boolean
  updated_at: Generated<Date>
  updated_by: bigint | null
}

// ---- REDEEM_CODES ---- (migration 052 — ปุ่ม "ใช้โค้ด" ในเนวบาร์)
export interface RedeemCodesTable {
  id:                 Generated<bigint>
  code:               string                        // เก็บตัวพิมพ์ใหญ่เสมอ (normalize ที่ service layer)
  type:               'instant_coins' | 'topup_bonus_percent' | 'referral'
  value:              Decimal                        // instant_coins = จำนวนเหรียญ, topup_bonus_percent = %
  bonus_window_hours: number | null                  // เฉพาะ topup_bonus_percent — null = ใช้ default 72 ที่ service layer
  max_uses:           number | null                  // null = ไม่จำกัด
  max_uses_per_user:  number
  used_count:         number
  valid_from:         Date | null
  valid_until:        Date | null
  label:              string | null
  status:             'active' | 'disabled'
  created_by:         bigint | null
  created_at:         Generated<Date>
  updated_at:         Generated<Date>
}

// ---- REDEEM_CODE_USES ---- (migration 052 — ประวัติการแลกแต่ละครั้ง)
export interface RedeemCodeUsesTable {
  id:                 Generated<bigint>
  code_id:            bigint
  user_id:            bigint
  type:               'instant_coins' | 'topup_bonus_percent' | 'referral'  // snapshot ตอนแลก
  value:              Decimal                                   // snapshot ตอนแลก
  status:             'pending' | 'consumed' | 'expired' | 'active'  // 'active' = referral ถาวร ไม่มีวันเปลี่ยนเป็น consumed
  expires_at:         Date | null
  consumed_at:        Date | null
  consumed_topup_id:  bigint | null
  ledger_id:          bigint | null
  redeemed_at:        Generated<Date>
}

// =============================================================
// DB — รวม tables ทั้งหมด
// =============================================================
export interface DB {
  categories:              CategoriesTable
  users:                   UsersTable
  works:                   WorksTable           // เดิม: cartoons
  topup_packages:          TopupPackagesTable
  coin_ledger:             CoinLedgerTable
  work_ep:                 WorkEpTable             // เดิม: manga_ep
  work_ep_image:           WorkEpImageTable       // เดิม: manga_ep_images → cartoon_ep_image
  ep_shop:                 EpShopTable
  topup_transactions:      TopupTransactionsTable
  withdrawals:             WithdrawalsTable
  bank_change_requests:    BankChangeRequestsTable
  user_detail:             UserDetailTable
  user_bans:               UserBansTable
  work_ep_views:           WorkEpViewsTable        // เดิม: manga_ep_views
  work_favorite:           WorkFavoriteTable       // เดิม: manga_favorite
  work_bookmarks:          WorkBookmarksTable      // migration 009 — "เก็บเข้าคลัง" แยกจาก work_favorite
  work_ep_bookmarks:       WorkEpBookmarksTable    // migration 023 — เก็บตอนโปรดเป็นรายตอน
  user_followers:          UserFollowersTable
  work_comments:           WorkCommentsTable       // เดิม: cartoon_comments
  comment_likes:           CommentLikesTable
  notifications:           NotificationsTable
  audit_logs:              AuditLogsTable
  announcements:           AnnouncementsTable
  carousels:               CarouselsTable
  featured_works:          FeaturedWorksTable
  web_setting:             WebSettingTable
  web_contacts:            WebContactsTable
  faqs:                    FaqsTable
  password_reset_tokens:   PasswordResetTokensTable
  novel_block_reports:     NovelBlockReportsTable
  episode_upload_jobs:     EpisodeUploadJobsTable
  // migration 044
  admin_novel_upload_jobs: AdminNovelUploadJobsTable
  // migration 035
  tts_jobs:                TtsJobsTable
  // migration 038
  tts_requests:            TtsRequestsTable
  tts_request_episodes:    TtsRequestEpisodesTable
  tts_work_access:         TtsWorkAccessTable
  tts_worker_heartbeats:   TtsWorkerHeartbeatsTable
  // migration 040
  tts_job_events:          TtsJobEventsTable
  tts_job_blocks:          TtsJobBlocksTable
  // migration 041
  user_work_auto_read_preferences: UserWorkAutoReadPreferencesTable
  tts_episode_edit_saves: TtsEpisodeEditSavesTable
  tts_work_character_labels: TtsWorkCharacterLabelsTable
  // migration 050
  tts_work_character_shortcuts: TtsWorkCharacterShortcutsTable
  // migration 003
  referral_code_requests:  ReferralCodeRequestsTable
  writer_referral_links:   WriterReferralLinksTable
  // migration 017
  tags:                    TagsTable
  work_tags:               WorkTagsTable
  // migration 019
  user_social_links:       UserSocialLinksTable
  // migration 024
  admin_action_requests:   AdminActionRequestsTable
  // migration 025
  content_reports:         ContentReportsTable
  // migration 032
  writer_admin_notices:    WriterAdminNoticesTable
  // migration 026
  login_history:           LoginHistoryTable
  // migration 027
  user_activity_suspensions: UserActivitySuspensionsTable
  user_spend_suspensions:    UserSpendSuspensionsTable
  admin_user_flags:          AdminUserFlagsTable
  // migration 047
  permission_actions:        PermissionActionsTable
  permission_matrix:         PermissionMatrixTable
  // migration 052
  redeem_codes:              RedeemCodesTable
  redeem_code_uses:          RedeemCodeUsesTable
}

// ---- TTS_JOBS ---- (migration 035 — render เสียงพากย์นิยาย)
export interface TtsJobsTable {
  id:               Generated<bigint>
  ep_id:            bigint
  requested_by:     bigint | null
  request_id:       bigint | null
  priority:         ColumnType<number, number | undefined, number>
  voice_slot:       ColumnType<'old_male' | 'young_male' | 'female' | 'pro', 'old_male' | 'young_male' | 'female' | 'pro' | undefined, 'old_male' | 'young_male' | 'female' | 'pro'>
  voice_profile_version: ColumnType<string, string | undefined, string>
  source_hash:      string
  // migration 050: immutable manual Tier 1 resolution plan for a Pro job.
  voice_assignments: ColumnType<unknown, unknown | undefined, unknown>
  voice_assignment_hash: string | null
  status:           ColumnType<'pending' | 'processing' | 'done' | 'failed' | 'cancelled', 'pending' | 'processing' | 'done' | 'failed' | 'cancelled' | undefined, 'pending' | 'processing' | 'done' | 'failed' | 'cancelled'>
  voice_mode:       ColumnType<'single' | 'multi', 'single' | 'multi' | undefined, 'single' | 'multi'>
  attempt_count:    ColumnType<number, number | undefined, number>
  max_attempts:     ColumnType<number, number | undefined, number>
  worker_id:        string | null
  lease_expires_at: Date | null
  audio_key:        string | null
  audio_url:        string | null
  duration_seconds: number | null
  error_message:    string | null
  failure_code:     string | null
  failure_stage:    string | null
  retryable:        boolean | null
  last_error_at:    Date | null
  cancelled_at:     Date | null
  available_at:     ColumnType<Date, Date | string | undefined, Date | string>
  total_blocks:     ColumnType<number, number | undefined, number>
  completed_blocks: ColumnType<number, number | undefined, number>
  current_block:    number | null
  progress_updated_at: Date | null
  requested_at:     Generated<Date>
  started_at:       Date | null
  completed_at:     Date | null
  updated_at:       Generated<Date>
}

export interface TtsRequestsTable {
  id:               Generated<bigint>
  p_id:             bigint
  requested_by:     bigint | null
  requester_type:   'writer' | 'reader' | 'admin' | 'system_update' | 'writer_edit'
  tier:             'basic' | 'pro'
  status:           'approval' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'rejected'
  source_episode_id: bigint | null
  auto_update:      ColumnType<boolean, boolean | undefined, boolean>
  priority:         ColumnType<number, number | undefined, number>
  approved_by:      bigint | null
  rejection_reason: string | null
  requested_at:     Generated<Date>
  approved_at:      Date | null
  queued_at:        Date | null
  started_at:       Date | null
  completed_at:     Date | null
  updated_at:       Generated<Date>
}

export interface TtsRequestEpisodesTable {
  request_id: bigint
  ep_id:      bigint
}

export interface TtsWorkAccessTable {
  p_id:        bigint
  tier:        'basic' | 'pro'
  auto_update: ColumnType<boolean, boolean | undefined, boolean>
  enabled_by:  bigint | null
  enabled_at:  Generated<Date>
  updated_at:  Generated<Date>
}

export interface TtsWorkerHeartbeatsTable {
  worker_id:      string
  started_at:     Generated<Date>
  last_seen_at:   Generated<Date>
  current_job_id: bigint | null
}

// ---- TTS recovery / future chunk repair (migration 040) ----
export interface TtsJobEventsTable {
  id:          Generated<bigint>
  job_id:      bigint
  request_id:  bigint | null
  event_type:  'claimed' | 'lease_reclaimed' | 'retry_scheduled' | 'failed' | 'completed' | 'cancelled' | 'manual_retry' | 'manual_cancel' | 'cleanup_failed'
  severity:    ColumnType<'info' | 'warning' | 'error', 'info' | 'warning' | 'error' | undefined, 'info' | 'warning' | 'error'>
  code:        string | null
  message:     string
  context:     ColumnType<unknown, unknown | undefined, unknown>
  created_at:  Generated<Date>
}

export interface TtsJobBlocksTable {
  id:                Generated<bigint>
  job_id:            bigint
  block_id:          string
  block_index:       number
  source_text_hash:  string
  status:            ColumnType<'pending' | 'processing' | 'done' | 'failed' | 'skipped' | 'cancelled', 'pending' | 'processing' | 'done' | 'failed' | 'skipped' | 'cancelled' | undefined, 'pending' | 'processing' | 'done' | 'failed' | 'skipped' | 'cancelled'>
  duration_seconds:  number | null
  start_seconds:     number | null
  end_seconds:       number | null
  error_code:        string | null
  error_message:     string | null
  started_at:        Date | null
  completed_at:      Date | null
  updated_at:        Generated<Date>
}

// ---- Reader auto-read preferences (migration 041) ----
export interface UserWorkAutoReadPreferencesTable {
  user_id:       bigint
  p_id:          bigint
  auto_next:     ColumnType<boolean, boolean | undefined, boolean>
  auto_purchase: ColumnType<boolean, boolean | undefined, boolean>
  updated_at:    Generated<Date>
}

// ---- TTS audio editor (migration 043) ----
export interface TtsEpisodeEditSavesTable {
  id:         Generated<bigint>
  ep_id:      bigint
  author_id:  bigint
  slot_no:    number
  name:       string
  payload:    ColumnType<unknown, unknown, unknown>
  created_at: Generated<Date>
  updated_at: Generated<Date>
}

export interface TtsWorkCharacterLabelsTable {
  id:             Generated<bigint>
  p_id:           bigint
  slot_no:        number
  // Legacy one-shortcut field. New writes use the child alias table.
  shortcut:       string | null
  display_name:   string
  voice_role:     'lead' | 'supporting' | 'extra'
  gender:         'male' | 'female'
  color:          string
  // migration 046 — ดู Tier1_DesignCore.md ข้อ 4. voice_category = ชื่อโฟลเดอร์เสียง (free-text
  // เช่น "handsome") voice_index = ลำดับจองต่อเรื่อง (p_id) ต่อหมวด เพิ่มขึ้นเรื่อยๆ ไม่ reuse
  // ซ้ำแม้ตัวละครเดิมเปลี่ยน/ลบหมวด worker เป็นคน wrap-around เองตอน resolve เป็นไฟล์จริง
  voice_category: string | null
  voice_index:    number | null
  voice_shared:   Generated<boolean>  // true = จองแบบ "!" ให้ตัวละครอื่นใช้ไฟล์เดียวกันร่วมได้
  created_at:     Generated<Date>
  updated_at:     Generated<Date>
}

// ---- TTS work character aliases (migration 050) ----
export interface TtsWorkCharacterShortcutsTable {
  id:          Generated<bigint>
  p_id:        bigint
  label_id:    bigint
  shortcut:    string
  created_at:  Generated<Date>
}
