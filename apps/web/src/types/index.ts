// ─── Auth ──────────────────────────────────────────────────────────────────────

export interface User {
  id: number
  uuid: string
  u_name: string
  display_name: string
  email: string
  level: number
  point: number
  sales: number
  user_img: string | null
  writer_tier: string | null
  auto_ep_purchase: boolean
  load_all_images: boolean
  created_at: string
}

// ─── Profile ───────────────────────────────────────────────────────────────────

export interface ProfileStats {
  read_count: number
  bookmark_count: number
  favorite_count: number
  comment_count: number
  follower_count: number
  following_count: number
}

export interface SocialLink {
  url: string
  label: string | null
}

// รูปทรงร่วมของหน้าโปรไฟล์ — ใช้ทั้งโปรไฟล์ตัวเอง (GET /users/me) และคนอื่น (GET /users/:uuid
// public) โดย mapper ของแต่ละหน้าแปลงให้ตรงรูปนี้เอง (โปรไฟล์ตัวเองมี field เพิ่มเช่น email/level
// แต่ไม่ส่งออกไปแสดงต่อสาธารณะ)
export interface ProfileData {
  uuid: string
  // u_name (username สำหรับ login) — มีแค่ตอนโปรไฟล์ตัวเอง (โชว์ในหน้าแก้ไขเผื่อลืม) โปรไฟล์
  // สาธารณะของคนอื่นไม่ส่งค่านี้มา (undefined) ตั้งใจไม่ให้เห็น username คนอื่นผ่านหน้านี้
  u_name?: string
  display_name: string
  user_img: string | null
  bio: string | null
  // ช่องทางโซเชียล/เว็บไซต์ สูงสุด 4 อัน (migration 019 — user_social_links แทน
  // social_media.website เดิม, ตัด location ทิ้งตามที่ user ขอ)
  social_links: SocialLink[]
  is_writer: boolean
  // เรา (viewer ปัจจุบัน) กำลัง follow เจ้าของโปรไฟล์นี้อยู่ไหม — โปรไฟล์ตัวเองไม่มีความหมาย
  // (follow ตัวเองไม่ได้) จึงตั้งเป็น false เสมอในหน้า /profile
  is_following: boolean
  // แท็บ "ทั้งหมด" ของกล่องผลงาน (นักอ่านทั่วไป) โชว์/ซ่อนจากคนอื่นได้ (migration 022, default
  // true) — เจ้าของเห็นของตัวเองเสมอไม่ว่าค่านี้เป็นอะไร มีผลกับ "คนอื่น" เท่านั้น
  bookmarks_public: boolean
  created_at: string
  stats: ProfileStats
}

export interface AuthResponse {
  access_token: string
  user: User
}

// ─── Works ─────────────────────────────────────────────────────────────────────

export type WorkType = 'manga' | 'novel'
export type AgeRate = 'all' | '18+' // migration 004: ลดจาก 4 ระดับเหลือ 2 ระดับ
export type CompletionStatus = 'ongoing' | 'completed' | 'hiatus'
export type PublishStatus = 0 | 1 | 2 // 0=draft, 1=published, 2=scheduled

export interface Work {
  p_id: number
  uuid: string
  title: string
  description: string
  cover_image: string | null
  author_id: number
  author_name: string
  type: WorkType
  age_rate: AgeRate
  publish_status: PublishStatus
  completion_status: CompletionStatus
  view_count: number
  category_main: number | null
  category_sub: number | null
  created_at: string
  updated_at: string
}

export interface WorkListItem {
  p_id: number
  uuid: string
  title: string
  cover_image: string | null
  type: WorkType
  age_rate: AgeRate
  completion_status: CompletionStatus
  view_count: number
  author_name: string
  latest_ep_no: number | null
  latest_ep_name: string | null
}

// ─── Home Page (Novel Card / Ranking) ──────────────────────────────────────────
// รูปทรงตรงกับ GET /works จริง (ดู works.service.ts) แต่เพิ่ม episode_count /
// like_count / extra_category_count ที่ backend ยังไม่ได้ return ตอนนี้
// — ต้องเพิ่ม endpoint ให้ส่งค่าพวกนี้มาก่อนค่อยเลิกใช้ mock

export interface CategoryRef {
  id: number
  name: string
}

export interface NovelCardData {
  uuid: string
  title: string
  cover_image: string | null
  author_name: string
  // 2026-08-05 หมวดหมู่ย่อยพิเศษ (ดู lib/special-tags.ts) — age_rate ใช้ทำวงกลม M มุมการ์ด, tags
  // ใช้แยก BL/GL (ปักหน้าสุดของ tags ถ้ามี) ออกมาโชว์เป็น pill ที่ 3 ก่อนพับที่เหลือเป็น "+n"
  age_rate?: AgeRate
  tags: string[]
  category_main: CategoryRef | null
  category_sub: CategoryRef | null
  extra_category_count: number
  episode_count: number
  view_count: number
  like_count: number // จำนวนคนกดหัวใจ (นับจาก work_favorite) — มติ 2026-07-12: ใช้แบบนับจำนวน ไม่ใช่ระบบให้ดาว
}

export interface RankingEntry extends NovelCardData {
  rank: number
}

// ─── Search / Browse Page ──────────────────────────────────────────────────────
// การ์ดผลลัพธ์หน้า /search ต้องการข้อมูลมากกว่า NovelCardData (การ์ดแคบใน carousel
// หน้าแรก) — เพิ่ม description/tags/comment_count/updated_at ที่ GET /works คืนมาแล้ว

export interface SearchResultData {
  uuid: string
  title: string
  description: string | null
  cover_image: string | null
  author_name: string
  age_rate?: AgeRate
  category_main: CategoryRef | null
  category_sub: CategoryRef | null
  tags: string[]
  view_count: number
  like_count: number
  comment_count: number
  updated_at: string
}

// ─── Episodes ──────────────────────────────────────────────────────────────────

export type EpPublishStatus = 'draft' | 'published' | 'scheduled'

export interface Episode {
  ep_id: number
  p_id: number
  ep_name: string
  ep_no: number
  ep_price: number
  ep_content: NovelBlock[] | null
  total_image: number
  image_protection: boolean
  publish_status: EpPublishStatus
  schedule_datetime: string | null
  lock_duration_days: number | null
  created_at: string
  updated_at: string
}

export interface EpisodeListItem {
  ep_id: number
  ep_name: string
  ep_no: number
  ep_price: number
  publish_status: EpPublishStatus
  lock_duration_days: number | null
  is_purchased: boolean       // ซื้อแล้ว (backend คำนวณ)
  is_free: boolean            // ฟรี (ep_price = 0)
  is_locked: boolean          // ล็อกอยู่ตอนนี้
}

// ─── Novel Blocks ──────────────────────────────────────────────────────────────
// sync กับ backend จริง (db/types.ts) แล้ว — เดิม type นี้ผิดเป็นคนละแบบ
// (paragraph/header/image/divider) ตอนนี้ตรงกับ ep_content JSONB จริงที่ backend ส่งมา

export interface NovelBlockStyle {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  color?: string // hex เช่น "#c0392b" หรือ null = ใช้ default
}

export interface NovelBlockAudioTs {
  start: number // วินาทีเริ่มใน audio file ของตอนนั้น
  end: number
}

// 2026-08-11 — ต้องตรงกับ NovelBlock ฝั่ง apps/api/src/db/types.ts เป๊ะเสมอ (เคยหลุดไม่ตรงกันมา
// 2 รอบแล้วตอน migration 043 เพิ่ม tts/tts_text เข้า backend แต่ลืมพอร์ตมาฝั่งนี้ — ดู KNOWN_ISSUES.md)
// 2026-08-16 — label→display_label, kind→block_kind ตาม Tier1_DesignCore.md (แยก concern แสดงผล
// ออกจาก TTS เด็ดขาด) ของเก่าใน DB ที่ยังไม่ resave จะยังมี key เดิม โค้ดฝั่งอ่าน (novel-blocks.ts
// normalizeStoredNovelBlock) fallback ให้เอง
export interface NovelBlockTts {
  block_kind?: 'narration' | 'gap'
  gap_seconds?: number
  skip?: boolean
  speaker_slot?: number
  emotion?: 'neutral' | 'sad' | 'angry' | 'happy' | 'excited' | 'fear' // aspirational — ยังไม่ใช้งานจริง
}

// display_label convention: "paragraph" / "narration" / "dialogue" / "dialogue:ชื่อ" / "action" / "heading"
export interface NovelBlock {
  id: string
  display_label: string
  text: string
  style: NovelBlockStyle | null
  audio_ts: NovelBlockAudioTs | null
  tts_text?: string
  tts?: NovelBlockTts
}

// ─── Manga Images ──────────────────────────────────────────────────────────────

export interface MangaImage {
  id: number
  ep_id: number
  image_path: string
  sort_order: number
}

// ─── Comments ──────────────────────────────────────────────────────────────────

export interface Comment {
  id: number
  work_id: number
  episode_id: number | null
  user_id: number
  parent_id: number | null
  content: string
  status: 'active' | 'deleted'
  likes_count: number
  author_name: string
  author_img: string | null
  is_liked: boolean
  replies: Comment[]
  created_at: string
}

// ─── Notifications ─────────────────────────────────────────────────────────────

export interface Notification {
  id: number
  type: string
  message: string
  ref_url: string | null
  is_read: boolean
  created_at: string
}

// ─── Categories ────────────────────────────────────────────────────────────────

export interface Category {
  id: number
  name: string
  status: boolean
}

// ─── Carousel & Announcements ──────────────────────────────────────────────────

export interface Carousel {
  id: number
  title: string | null
  subtitle: string | null
  image_path: string
  link_url: string | null
  sort_order: number
  status: 'active' | 'inactive'
}

export interface Announcement {
  id: number
  title: string
  content: string
  status: 'active' | 'inactive'
  created_at: string
}

// ─── Topup ─────────────────────────────────────────────────────────────────────
// ตรงกับ apps/api/src/modules/topup/topup.service.ts เป๊ะ — ตัวเลข/ราคาทุกอย่างเป็น string
// เสมอ (NUMERIC/BIGINT ฝั่ง DB ส่งมาเป็น string กัน float precision loss) ห้ามใช้ number เด็ดขาด

/** ตรงกับ GET /topup/packages (getTopupPackages() — ไม่มี field status ส่งมาด้วย กรองไว้ฝั่ง
    backend แล้วว่าโชว์ได้ ไม่ต้องเช็คซ้ำฝั่งนี้) */
export interface TopupPackage {
  id: string
  coin_amount: string
  bonus: string
  total_coins: string
  price: string
}

/** ตรงกับ response ของ POST /topup/initiate (initiateTopup()) — qr_code_data/is_mock เป็นของ
    mock mode เท่านั้น (ดู comment ยาวใน topup.service.ts) จะหายไปตอน integrate gateway จริง
    แล้วเปลี่ยนเป็น field อื่นแทน (เช่น payment_url) */
export interface TopupInitiateResponse {
  transaction_id: string
  ref_id: string
  amount: string
  coins: string
  payment_method: 'promptpay' | 'truemoney'
  qr_code_data: string
  is_mock: boolean
}

/** ตรงกับ GET /topup/status/:ref_id (getTopupStatus()) — สำหรับ poll รอผลหลัง initiate */
export interface TopupStatusResponse {
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  coins_added: string
  point: string
}

/** ตรงกับแถวใน GET /topup/history (getTopupHistory()) — ref_id คือรหัสภายในของเราเอง (TP-prefix,
    คงที่ตลอด) ส่วน transaction_id คือรหัสฝั่ง "gateway" (ตอน pending จะเหมือน ref_id เป๊ะ พอ
    completed แล้วจะถูกแทนที่ด้วยรหัสจริงจาก gateway — หรือ mock gateway ถ้ายังไม่ต่อจริง) */
export interface TopupHistoryRow {
  id: string
  ref_id: string
  transaction_id: string
  payment_method: 'promptpay' | 'truemoney'
  amount_paid: string
  coins_added: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  created_at: string
  updated_at: string
}

/** ตรงกับแถวใน GET /purchase/history (getPurchaseHistory()) — is_expired คำนวณฝั่ง backend แล้ว
    จาก lock_after_datetime (null = ซื้อขาด ไม่มีวันหมดอายุ) ไม่ต้องคำนวณซ้ำฝั่งนี้ */
export interface PurchaseHistoryRow {
  id: string
  ep_id: string
  ep_name: string
  ep_no: number
  work_title: string
  work_uuid: string
  work_type: string
  cover_image: string | null
  price: string
  lock_after_datetime: string | null
  is_expired: boolean
  created_at: string
}

/** ตรงกับแถวใน GET /redeem-codes/history (getMyRedeemHistory()) — value เป็น snapshot "ความหมาย
    ของโค้ด" ตอนแลก (เช่น type='referral' → value = % ค่าคอมมิชชั่นของเจ้าของโค้ด ไม่ใช่เหรียญที่
    ตัวเอง (ผู้กรอกโค้ด) ได้รับตอนสมัคร) ใช้ coins_credited แทนเสมอถ้าจะโชว์ "ได้กี่เหรียญจริง" —
    join มาจาก coin_ledger.delta ผ่าน ledger_id ตรงๆ (null = ยังไม่มีเหรียญเข้าจริง เช่น
    topup_bonus_percent ที่ยัง pending รอเติมเงินอยู่) */
export interface RedeemHistoryRow {
  id: string
  code: string
  type: 'instant_coins' | 'topup_bonus_percent' | 'referral'
  value: string
  coins_credited: string | null
  status: 'pending' | 'consumed' | 'expired' | 'active'
  expires_at: string | null
  consumed_at: string | null
  redeemed_at: string
}

// ─── Coin Ledger ───────────────────────────────────────────────────────────────

export interface CoinLedgerEntry {
  id: number
  delta: number               // บวก = เพิ่ม, ลบ = ใช้
  reason: string
  balance_after: number
  created_at: string
}

// ─── Writer ────────────────────────────────────────────────────────────────────

export interface WithdrawalRequest {
  id: number
  amount: number
  fee_percent: number
  rate: number
  net_amount: number
  status: 'pending' | 'approved' | 'rejected'
  reason: string | null
  created_at: string
}

// ─── Pagination ────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─── API Error ─────────────────────────────────────────────────────────────────

export interface ApiError {
  success: false
  message: string
}
