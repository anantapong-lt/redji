import type { JSONContent } from '@tiptap/react'
import type { CategoryRef } from '@/types'

// รูปทรงตรงกับ GET /works/:uuid จริงแล้ว (ดู lib/work-detail-mapper.ts) — is_following
// ยังเป็น mock เพราะยังไม่มีปุ่ม follow ในดีไซน์หน้านี้ (ดู KNOWN_ISSUES.md)
export interface WorkDetail {
  uuid: string
  title: string
  cover_image: string | null
  author_uuid: string
  author_name: string
  author_img: string | null
  is_following: boolean
  category_main: CategoryRef | null
  category_sub: CategoryRef | null
  tags: string[]
  description: string | null // "คำโปรย" — สั้น เอาไว้ทำ SEO ด้วย
  synopsis: JSONContent | null // "เรื่องย่อ" — เนื้อหายาว rich text
  age_rate: 'all' | '18+'
  view_count: number
  like_count: number
  comment_count: number
  bookmark_count: number
  is_liked: boolean
  is_bookmarked: boolean
  created_at: string
  first_ep_no: number | null
  latest_ep_no: number | null
}

export interface EpisodeToc {
  ep_id: string
  ep_no: number
  ep_name: string
  episode_label: string | null // migration 014: "คำเรียกตอน" ค่าต่อตอน เช่น "ตอนที่", "บทที่"
  updated_at: string
  // 2026-08-05 เพิ่ม — ต้องใช้โชว์ราคาในสารบัญ + เช็คก่อนเปิด modal ยืนยันซื้อตอนที่ล็อกไว้
  ep_price: string
  is_free: boolean
  is_purchased: boolean
  is_read: boolean
}

export interface WorkComment {
  id: string
  author_name: string
  author_img: string | null
  is_author: boolean // เจ้าของผลงานคอมเม้นเอง (ไม่ใช่ reader_message) — โชว์ badge เฉยๆ ไม่ไฮไลต์พื้นหลัง
  content: string
  likes_count: number
  is_liked: boolean
  created_at: string
  /** null = คอมเม้นตรงหน้า Card, มีค่า = คอมเม้นในตอนนั้นๆ */
  episode_no: number | null
}

