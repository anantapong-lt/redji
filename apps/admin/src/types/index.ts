/** ผู้ใช้ที่ login เข้าแอป Admin เอง — ต้อง level >= 9 ถึงจะผ่าน AdminGuard ได้ */
export interface AdminSelf {
  id: number
  uuid: string
  u_name: string
  display_name: string
  email: string
  level: number
  point: number
  sales: number
  user_img: string | null
  created_at: string
}

/** แถวในตาราง "จัดการผู้ใช้" — ตรงกับ listUsers() ใน admin.service.ts
    point/sales เป็น string เพราะเป็น BIGINT จาก Postgres (ห้าม parse เป็น number ตรงๆ
    ถ้าจะโชว์เฉยๆ ใช้ string ได้เลย ไม่ต้องคำนวณอะไรในหน้านี้)
    coins_spent_week/coins_spent_month = undefined ถ้าคนดูเป็น level 8 (backend ตัด field ออก
    เลยจริงๆ ผ่าน stripFinancialFields ไม่ใช่แค่ซ่อนฝั่งนี้ — ดู admin.routes.ts) */
export interface AdminUserRow {
  id: string
  uuid: string
  display_name: string
  u_name: string
  email: string
  level: number
  point: string
  sales: string
  created_at: string
  is_banned: boolean
  ban_reason: string | null
  banned_at: string | null
  /** ใครสร้างบัญชีนี้ผ่านระบบหน่วยรบ (admin/squad) — null ถ้าสมัครเอง (2026-08-12) */
  creator: { uuid: string; display_name: string } | null
  reads_today: number
  coins_spent_week?: string
  reads_month: number
  coins_spent_month?: string
  last_login_at: string | null
  is_activity_suspended: boolean
  is_spend_suspended: boolean
  /** เฉพาะตอนเรียก /admin/users?writers_only=true (แท็บ "นักเขียนของเว็บ") — ดู getWriterStatsBatch()
      ใน admin.service.ts ฝั่ง backend, ตัวเลขเดียวกับที่หน้าโปรไฟล์เว็บโชว์ */
  work_count?: number
  read_count?: number
  bookmark_count?: number
  favorite_count?: number
  comment_count?: number
  follower_count?: number
  following_count?: number
}

/** รายละเอียดเต็มของ user คนเดียว — ตรงกับ getUserDetail() (migration 027) */
export interface AdminUserDetail extends AdminUserRow {
  user_img: string | null
  updated_at: string
  is_deleted: boolean
  deletion_reason: string | null
  activity_suspended_reason: string | null
  activity_suspended_at: string | null
  spend_suspended_reason: string | null
  spend_suspended_at: string | null
}

export type FlagActionType = 'suspend_activity' | 'suspend_spending' | 'ban' | 'delete'

/** Flag ที่ level 8 ส่งมา — ตรงกับ admin_user_flags (migration 027) */
export interface AdminUserFlag {
  id: string
  action_type: FlagActionType
  reason: string
  status: 'pending' | 'auto_executed' | 'executed' | 'dismissed'
  review_note: string | null
  created_at: string
  reviewed_at: string | null
  target: { uuid: string; display_name: string; u_name: string }
  flagged_by: { uuid: string; display_name: string }
  reviewed_by_name: string | null
  pending_count: number
  threshold: number
}

export interface UserLoginRecord {
  id: string
  success: boolean
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface UserTopupRecord {
  id: string
  transaction_id: string
  payment_method: string
  amount_paid: string
  coins_added: string
  status: string
  created_at: string
}

export interface UserCommentRecord {
  id: string
  content: string
  likes_count: number
  status: string
  created_at: string
  work: { uuid: string; title: string }
}

export interface UserReadingRecord {
  id: string
  ep_no: number
  created_at: string
  work: { uuid: string; title: string }
  is_purchased: boolean
  purchase_price: string | null
}

export interface UserSpendingPoint {
  date: string
  amount: string
}

/** คำขอ ban_user (level 8 ส่ง, level>=9 อนุมัติ) หรือ promote_level_8 (level 9 ส่ง, level>=10 อนุมัติ) */
export interface AdminActionRequest {
  id: string
  request_type: 'ban_user' | 'promote_level_8'
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  review_note: string | null
  created_at: string
  reviewed_at: string | null
  target: { uuid: string; display_name: string; u_name: string; level: number }
  requested_by: { uuid: string; display_name: string }
  reviewed_by_name: string | null
}

/** คำขอเป็นนักเขียน — ตรงกับ user_detail + listWriterApplications() */
export interface WriterApplicationRow {
  id: string
  user: { uuid: string; display_name: string; u_name: string; email: string; level: number }
  user_prefix: string
  first_name: string
  last_name: string
  national_id: string | null
  id_address: string | null
  id_province: string | null
  id_district: string | null
  id_subdistrict: string | null
  id_postal_code: string | null
  current_address: string | null
  current_province: string | null
  current_district: string | null
  current_subdistrict: string | null
  current_postal_code: string | null
  user_phone: string
  bank_name: string
  bank_branch: string | null
  bank_number: string | null
  status: 'pending' | 'approve' | 'rejected'
  application_type: 'new_writer' | 'edit'
  reject_reason: string | null
  created_at: string
  updated_at: string
}

/** รายงานเนื้อหา — ตรงกับ content_reports + listContentReports() (migration 025)
    target.exists = false หมายถึงเนื้อหาที่ถูกรายงานถูกลบไปแล้วตอนที่แอดมินมาดู */
export interface ContentReportRow {
  id: string
  target_type: 'comment' | 'work' | 'user'
  target_id: string
  target: {
    exists: boolean
    preview: string | null
    author_name: string | null
    work_uuid: string | null
    work_title: string | null
    user_uuid: string | null
    u_name: string | null
  }
  reason: string
  status: 'pending' | 'resolved' | 'dismissed'
  review_note: string | null
  created_at: string
  reviewed_at: string | null
  reported_by: { uuid: string; display_name: string }
  reviewed_by_name: string | null
  // migration 032: หมวดหมู่ + หมายเหตุนักเขียน (category=null = รายงานเก่าก่อนมี migration นี้)
  category: string | null
  writer_note: string | null
  writer_acknowledged_at: string | null
}

export interface Pagination {
  page: number
  limit: number
  total: number
  pages: number
}

/** คำขอถอนเงินนักเขียน — ตรงกับ listWithdrawals() (แท็บ "จัดการธุรกรรม", level >= 9 เท่านั้น)
    migration 031: เลิกใช้ fee_percent (% ส่วนแบ่งรายได้) เปลี่ยนเป็น fee_amount (ค่าธรรมเนียม
    คงที่ 20 บาท ถ้าเกินโควตาฟรี 2 ครั้ง/เดือน) + เพิ่ม snapshot บัญชีธนาคารที่ใช้โอนจริง */
export interface WithdrawalRow {
  id: string
  amount: string
  net_amount: string
  fee_amount: string
  bank_code: string
  account_name: string
  account_number: string
  status: 'pending' | 'approved' | 'rejected'
  reason: string | null
  created_at: string
  approved_at: string | null
  // migration 033/034: หลักฐานการโอน (สลิป) + ชื่อผู้โอนที่พิมพ์เอง (transferred_by_name — ใช้โชว์
  // คอลัมน์ "ผู้โอน") แยกจาก approved_by_name (ชื่อบัญชีแอดมินที่ล็อกอินกดปุ่มจริง เก็บไว้เป็น
  // audit trail อีกชั้น เผื่อบัญชีแอดมินถูกใช้ร่วมกันหลายคน) — เป็น null เสมอถ้ายัง pending/rejected
  transfer_proof_url: string | null
  transferred_by_name: string | null
  approved_by_name: string | null
  user: { uuid: string; display_name: string; email: string }
}

/** คำขอตั้ง/เปลี่ยนบัญชีธนาคาร — ตรงกับ listBankChangeRequests() (migration 031) — document_url
    คือภาพหลักฐาน (สมุดบัญชี+บัตรประชาชน) ที่นักเขียนแนบมา ต้องดูก่อนอนุมัติเสมอ */
export interface BankChangeRequestRow {
  id: string
  bank_code: string
  account_name: string
  account_number: string
  reason: string | null
  document_url: string
  status: 'pending' | 'approved' | 'rejected'
  review_note: string | null
  created_at: string
  reviewed_at: string | null
  user: { uuid: string; display_name: string; email: string }
}

/** ใบสมัครนักเขียนล่าสุดของ user คนหนึ่ง — ตรงกับ getWriterApplicationForUser()
    (ใช้ในปุ่ม "ดูเพิ่มเติม" ของตาราง "นักเขียนของเว็บ") null ถ้าไม่เคยสมัครเลย */
export interface WriterApplicationDetail {
  id: string
  user_prefix: string
  first_name: string
  last_name: string
  national_id: string | null
  id_address: string | null
  id_province: string | null
  id_district: string | null
  id_subdistrict: string | null
  id_postal_code: string | null
  current_address: string | null
  current_province: string | null
  current_district: string | null
  current_subdistrict: string | null
  current_postal_code: string | null
  user_phone: string
  bank_name: string
  bank_branch: string | null
  bank_number: string | null
  status: 'pending' | 'approve' | 'rejected'
  application_type: 'new_writer' | 'edit'
  reject_reason: string | null
  created_at: string
  updated_at: string
}

/** ผลงานของนักเขียนคนหนึ่ง — ตรงกับ getWriterWorksList() */
export interface WriterWorkRow {
  uuid: string
  title: string
  cover_image: string | null
  type: 'manga' | 'novel'
  publish_status: 0 | 1
  completion_status: 'ongoing' | 'completed' | 'hiatus' | null
  view_count: string
  created_at: string
}

/** แถวประวัติ (audit log) — ตรงกับ getAuditLogs() (แท็บ "ประวัติ", level >= 9 เท่านั้น)
    description ฝัง target_type/target_id/เหตุผลไว้ในข้อความอยู่แล้ว (ดู writeAuditLog()
    ฝั่ง backend) ไม่ต้อง parse metadata แยกสำหรับโชว์ทั่วไป */
export interface AuditLogRow {
  id: string
  event_type: string
  description: string
  metadata: unknown
  created_at: string
  admin_uuid: string
  admin_name: string
}

// =============================================================
// "ผลงาน" (2026-08-04, ใหม่) — แอดมิน (level >= 9) แก้ผลงานของนักเขียนคนไหนก็ได้เหมือนนักเขียน
// แก้ของตัวเอง ดู admin-works.service.ts/admin-works.routes.ts ฝั่ง backend (delegate ไปที่
// writer.service.ts โดยสวม author_id ของเจ้าของจริง — payload/response หน้าตาตรงกับฝั่ง writer
// (GET/PATCH /writer/works/:uuid, /writer/episodes/:ep_id) ทุกจุด)
// =============================================================

// 2026-08-16 — เคยขาด tts/tts_text ไปเลยจาก NovelBlock ฝั่ง apps/api/src/db/types.ts (drift ที่ยัง
// ไม่เคยพอร์ตมา) เพิ่มให้ครบพร้อมกับ rename label→display_label, kind→block_kind ตาม
// Tier1_DesignCore.md เพราะ apps/admin เขียน ep_content ตรงๆ ผ่าน episode-dialog.tsx เป็นอีก write
// path จริง ต้องตรงกับ apps/api/src/db/types.ts เป๊ะเหมือนฝั่ง apps/web
export interface NovelBlockTts {
  block_kind?: 'narration' | 'gap'
  gap_seconds?: number
  skip?: boolean
  speaker_slot?: number
  emotion?: 'neutral' | 'sad' | 'angry' | 'happy' | 'excited' | 'fear'
}

/** block เดียวของเนื้อหาตอน — ตรงกับ NovelBlock ใน apps/api/src/db/types.ts */
export interface NovelBlock {
  id: string
  display_label: string
  text: string
  style: { bold?: boolean; italic?: boolean; underline?: boolean; color?: string } | null
  audio_ts: { start: number; end: number } | null
  tts_text?: string
  tts?: NovelBlockTts
}

/** ตรงกับ GET /categories */
export interface CategoryRef {
  id: number
  name: string
}

export type AgeRate = 'all' | '18+'

/** การ์ดใน gallery "ผลงาน" — ตรงกับ listWorksGallery() */
export interface AdminWorkGalleryItem {
  uuid: string
  title: string
  cover_image: string | null
  type: 'manga' | 'novel'
  age_rate: AgeRate
  publish_status: 0 | 1
  status: 'active' | 'deleted'
  updated_at: string
  author: { uuid: string; display_name: string; u_name: string }
}

/** ข้อมูลเต็มของผลงานเรื่องเดียว (หน้าแก้ไข) — ตรงกับ getWorkDetailAdmin() */
export interface AdminWorkDetail {
  uuid: string
  title: string
  original_title: string | null
  description: string | null
  synopsis: object | null
  cover_image: string | null
  age_rate: AgeRate
  is_translated: boolean
  tags: string[]
  is_one_shot: boolean
  completion_status: 'ongoing' | 'completed' | 'hiatus' | null
  publish_status: 0 | 1
  status: 'active' | 'deleted'
  category_main: { id: string; name: string } | null
  category_sub: { id: string; name: string } | null
  created_at: string
  updated_at: string
  author: { uuid: string; display_name: string; u_name: string }
}

/** แถวในตาราง "รายตอน" — ตรงกับ getEpisodesAdmin() */
export interface AdminEpisodeRow {
  ep_id: string
  ep_name: string
  ep_no: number
  ep_price: string
  is_free: boolean
  publish_status: 'now' | 'schedule' | 'hide'
  episode_label: string | null
  updated_at: string
}

/** ข้อมูลเต็มของตอนเดียว (หน้าต่างแก้ไขตอน) — ตรงกับ getEpisodeDetailAdmin() */
export interface AdminEpisodeDetail {
  ep_id: string
  ep_no: number
  ep_name: string
  ep_price: string
  ep_content: NovelBlock[] | null
  publish_status: 'now' | 'schedule' | 'hide'
  schedule_datetime: string | null
  lock_duration_days: number | null
  image_protection: boolean
  reader_message: string | null
  episode_label: string | null
  type: 'novel' | 'manga'
}

// =============================================================
// "ตั้งหน้าเว็บไซต์" (2026-08-04, ใหม่) — 3 แท็บ: Carousel / นิยายแนะนำ / ประวัติ
// ดู admin.service.ts ฝั่ง backend (Carousel Management + Featured Works sections)
// =============================================================

/** แถว carousel เต็มรูปแบบ — ตรงกับ listCarousels()/createCarousel()/updateCarousel() */
export interface CarouselRow {
  id: string
  title: string | null
  subtitle: string | null
  image_path: string
  link_url: string | null
  sort_order: number
  status: 'active' | 'inactive'
  start_at: string
  end_at: string | null
  display_seconds: string
  note: string | null
  created_at: string
  updated_at: string
}

/** แถวประกาศหน้าเว็บ — ตรงกับ listAnnouncements()/createAnnouncement()/updateAnnouncement() */
export interface AnnouncementRow {
  id: string
  title: string
  content: string
  status: 'active' | 'inactive'
  color: 'green' | 'red' | 'purple' | 'gold'
  created_by: string | null
  created_by_name: string
  created_at: string
  updated_at: string
}

/** แถวหมวดหมู่นิยาย (แท็บ "หมวดหมู่" ใน ตั้งหน้าเว็บไซต์) — ตรงกับ getCategoriesAdmin() */
export interface CategoryAdminRow {
  id: string
  name: string
  icon: string | null
  status: boolean
  work_count: number
}

/** แถวหมวดหมู่ย่อย (tag) — แท็บ "หมวดหมู่ย่อย" ใน ตั้งหน้าเว็บไซต์ — ตรงกับ getTagsAdmin() */
export interface TagAdminRow {
  id: string
  name: string
  work_count: number
  last_used_at: string | null
  status: 'active' | 'unused'
}

/** เรื่องที่ใส่หมวดหมู่ย่อยหนึ่งๆ — ตรงกับ getWorksForTag() */
export interface TagWorkRow {
  p_id: string
  uuid: string
  title: string
  cover_image: string | null
  is_published: boolean
  author_name: string
}

/** โค้ดใช้แล้ว/เติมเหรียญ (แท็บ "โค้ดส่วนลด/เติมเหรียญ" ใน จัดการธุรกรรม) — ตรงกับ getRedeemCodesAdmin() */
export interface RedeemCodeAdminRow {
  id: string
  code: string
  type: 'instant_coins' | 'topup_bonus_percent' | 'referral'
  value: string
  bonus_window_hours: number | null
  max_uses: number | null
  max_uses_per_user: number
  used_count: number
  valid_from: string | null
  valid_until: string | null
  label: string | null
  status: 'active' | 'disabled'
  created_at: string
  updated_at: string
}

/** ประวัติการแลกโค้ดหนึ่งใบ — ตรงกับ getRedeemCodeUses() */
export interface RedeemCodeUseRow {
  id: string
  type: 'instant_coins' | 'topup_bonus_percent' | 'referral'
  value: string
  status: 'pending' | 'consumed' | 'expired' | 'active'
  expires_at: string | null
  consumed_at: string | null
  consumed_topup_id: string | null
  redeemed_at: string
  user: { uuid: string; display_name: string; u_name: string }
}

/** ช่องทางติดต่อภายนอก (แท็บ "ช่องทางติดต่อ" ใน ตั้งหน้าเว็บไซต์) — ตรงกับ getWebContactsAdmin() */
export interface WebContactAdminRow {
  id: string
  label: string
  url: string
  icon_class: string | null
  sort_order: number
  status: boolean
}

/** คำถามที่พบบ่อย (แท็บ "FAQ" ใน ตั้งหน้าเว็บไซต์) — ตรงกับ getFaqsAdmin() */
export interface FaqAdminRow {
  id: string
  question: string
  answer: string
  sort_order: number
  status: boolean
}

/** แถวในคิว "นิยายแนะนำ" ที่บูสต์อยู่ตอนนี้ — ตรงกับ listFeaturedWorks() */
export interface FeaturedWorkRow {
  id: string
  section: 'sales' | 'popular' | 'latest'
  sort_order: number
  expires_at: string
  created_at: string
  work: { uuid: string; title: string; cover_image: string | null }
}

/** แถวในตาราง "จำลองหน้า Home" (ผสม organic+boosted จริง) — ตรงกับ getFeaturedPreview() */
export interface FeaturedPreviewRow {
  featured_id: string | null // null = ไม่ใช่ของบูสต์ (ผลงานจริงที่ติดอันดับเอง)
  uuid: string
  title: string
  cover_image: string | null
  is_boosted: boolean
  expires_at: string | null
  reads_today: number
  total_reads: number
  episode_count: number
  monthly_earning: number
}

/** แถวในตาราง "หน่วยรบ" — ตรงกับ listSquadAdmins() (2026-08-12) */
export interface SquadAdminRow {
  uuid: string
  u_name: string
  display_name: string
  level: number // 8 | 9 | 10
  created_at: string
  quota: number | null // มีค่าเฉพาะ level 9 เท่านั้น
  creator: { uuid: string; display_name: string } | null
  is_suspended: boolean
  suspension_reason: string | null
}

/** รายการ "ประวัติ" หน่วยรบ — ตรงกับ getSquadHistory() */
export interface SquadHistoryRow {
  id: string
  event_type: string
  note: string | null
  created_at: string
  actor: { uuid: string; display_name: string } | null
  target: { u_name: string; display_name: string; level: number } | null
}
