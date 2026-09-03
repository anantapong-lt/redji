import type { JSONContent } from '@tiptap/react'
import type { CategoryRef } from '@/types'
import type { WorkDetail, EpisodeToc, WorkComment } from './mock-work-detail'

// รูปทรงตรงกับ GET /works/:uuid จริง (getWorkByUuid, works.service.ts)
// ใช้ร่วมกันทั้งหน้ารายละเอียดนิยาย (works/[uuid]/page.tsx) และหน้าอ่านตอน
// (works/[uuid]/read/[epNo]/page.tsx) เพราะทั้งคู่ต้องใช้ episodes list สำหรับ TOC/nav
export interface ApiWorkDetail {
  uuid: string
  title: string
  description: string | null
  synopsis: JSONContent | null
  tags: string[]
  cover_image: string | null
  age_rate: 'all' | '18+'
  completion_status: 'ongoing' | 'completed' | 'hiatus' | null
  view_count: string
  like_count: number
  is_liked: boolean
  comment_count: number
  bookmark_count: number
  is_bookmarked: boolean
  created_at: string
  author: { uuid: string; u_name: string; display_name: string; user_img: string | null }
  category_main: { id: string; name: string } | null
  category_sub: { id: string; name: string } | null
  episodes: {
    ep_id: string
    ep_name: string
    ep_no: number
    ep_price: string
    is_free: boolean
    is_purchased: boolean // 2026-08-05 ใหม่ — false เสมอถ้าเป็น guest
    is_read: boolean      // 2026-08-05 ใหม่ — จาก work_ep_views, false เสมอถ้าเป็น guest
    episode_label: string | null // migration 014: ค่าต่อตอน
    created_at: string
    updated_at: string
  }[]
}

export interface ApiComment {
  id: string
  content: string
  likes_count: number
  is_liked: boolean
  created_at: string
  from_episode: { ep_no: number; ep_name: string } | null
  user: { uuid: string; display_name: string; user_img: string | null; is_author: boolean }
}

// จำนวนคอมเม้นต่อหน้า — ใช้ตรงกันทั้ง query param `limit` ที่ยิงไป backend และ UI ที่โชว์
export const COMMENTS_PAGE_SIZE = 5

// รูปทรงตรงกับ GET /works/:uuid/comments จริง (getComments, social.service.ts) — คืน
// pagination มาด้วยเสมอ (เดิม frontend ทิ้ง field นี้ไปเลยหลัง .then(res => res.data) ทำให้
// คอมเม้นเกิน limit เริ่มต้นเข้าไม่ถึง — ดู KNOWN_ISSUES.md)
export interface ApiCommentsResponse {
  data: ApiComment[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

function toCategoryRef(c: { id: string; name: string } | null): CategoryRef | null {
  return c ? { id: Number(c.id), name: c.name } : null
}

export function mapWorkDetail(w: ApiWorkDetail): WorkDetail {
  const sortedEpisodes = [...w.episodes].sort((a, b) => a.ep_no - b.ep_no)
  return {
    uuid: w.uuid,
    title: w.title,
    cover_image: w.cover_image,
    author_uuid: w.author.uuid,
    author_name: w.author.display_name,
    author_img: w.author.user_img,
    is_following: false, // ยังไม่ได้ดึง/ใช้จริง — ไม่มีปุ่ม follow ในหน้านี้ตอนนี้
    category_main: toCategoryRef(w.category_main),
    category_sub: toCategoryRef(w.category_sub),
    tags: w.tags,
    description: w.description,
    synopsis: w.synopsis,
    age_rate: w.age_rate,
    view_count: Number(w.view_count),
    like_count: w.like_count,
    comment_count: w.comment_count,
    bookmark_count: w.bookmark_count,
    is_liked: w.is_liked,
    is_bookmarked: w.is_bookmarked,
    created_at: w.created_at,
    first_ep_no: sortedEpisodes[0]?.ep_no ?? null,
    latest_ep_no: sortedEpisodes[sortedEpisodes.length - 1]?.ep_no ?? null,
  }
}

export function mapEpisodes(w: ApiWorkDetail): EpisodeToc[] {
  return w.episodes.map((ep) => ({
    ep_id: ep.ep_id,
    ep_no: ep.ep_no,
    ep_name: ep.ep_name,
    episode_label: ep.episode_label,
    updated_at: ep.updated_at,
    ep_price: ep.ep_price,
    is_free: ep.is_free,
    is_purchased: ep.is_purchased,
    is_read: ep.is_read,
  }))
}

export function mapComments(comments: ApiComment[]): WorkComment[] {
  return comments.map((c) => ({
    id: c.id,
    author_name: c.user.display_name,
    author_img: c.user.user_img,
    is_author: c.user.is_author,
    content: c.content,
    likes_count: c.likes_count,
    is_liked: c.is_liked,
    created_at: c.created_at,
    episode_no: c.from_episode?.ep_no ?? null,
  }))
}
