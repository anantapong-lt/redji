// =============================================================
// Novel Platform — Social Service
// วางไว้ที่: apps/api/src/modules/social/social.service.ts
// =============================================================

import { db } from '../../db'
import { sql } from 'kysely'
import { getWorkCounts, getWorks } from '../works/works.service'
import { isValidReportCategory, type ReportCategory } from '../../lib/report-categories'

// =============================================================
// Follow Functions
// =============================================================

// ---- Follow writer ----
export async function followUser(followerId: bigint, targetUuid: string) {
  const target = await db
    .selectFrom('users')
    .select('id')
    .where('uuid', '=', targetUuid)
    .executeTakeFirst()

  if (!target) throw new Error('USER_NOT_FOUND')
  if (BigInt(target.id) === followerId) throw new Error('CANNOT_FOLLOW_SELF')

  const existing = await db
    .selectFrom('user_followers')
    .select('follower_id')
    .where('follower_id', '=', followerId)
    .where('following_id', '=', target.id)
    .executeTakeFirst()

  if (existing) throw new Error('ALREADY_FOLLOWING')

  await db
    .insertInto('user_followers')
    .values({ follower_id: followerId, following_id: target.id })
    .execute()
}

// ---- Unfollow writer ----
export async function unfollowUser(followerId: bigint, targetUuid: string) {
  const target = await db
    .selectFrom('users')
    .select('id')
    .where('uuid', '=', targetUuid)
    .executeTakeFirst()

  if (!target) throw new Error('USER_NOT_FOUND')

  const existing = await db
    .selectFrom('user_followers')
    .select('follower_id')
    .where('follower_id', '=', followerId)
    .where('following_id', '=', target.id)
    .executeTakeFirst()

  if (!existing) throw new Error('NOT_FOLLOWING')

  await db
    .deleteFrom('user_followers')
    .where('follower_id', '=', followerId)
    .where('following_id', '=', target.id)
    .execute()
}

// ---- รายการที่ฉัน follow ----
export async function getFollowing(userId: bigint, page: number, limit: number) {
  const offset = (page - 1) * limit

  const rows = await db
    .selectFrom('user_followers as f')
    .innerJoin('users as u', 'u.id', 'f.following_id')
    .select([
      'u.uuid',
      'u.display_name',
      'u.u_name',
      'u.user_img',
      'u.level',
      'f.created_at as followed_at',
    ])
    .where('f.follower_id', '=', userId)
    .orderBy('f.created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  const countRow = await db
    .selectFrom('user_followers')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('follower_id', '=', userId)
    .executeTakeFirstOrThrow()

  const total = Number(countRow.total)

  return {
    data: rows,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

// ---- "นักเขียนที่ติดตาม" (หน้า Feed, 2026-07-29) ----
// ผลงานล่าสุดของนักเขียนทุกคนที่ฉัน follow อยู่ รวมกันเป็นแถวเดียว (เรียงล่าสุดก่อน) —
// เรียก getWorks() ซ้ำ (ได้ tag-count/episode-count/like-count ฟรีเหมือน getAuthorWorks())
// กรอง author_id IN (รายชื่อที่ follow) แทนที่จะเป็นคนเดียว — การ์ดที่ได้ shape ตรงกับ
// GET /works เป๊ะ (frontend ใช้ mapper เดียวกับหน้าแรกได้เลย ไม่ต้องทำ mapper แยก)
export async function getFollowedWritersFeed(userId: bigint, limit: number) {
  const followingRows = await db
    .selectFrom('user_followers')
    .select('following_id')
    .where('follower_id', '=', userId)
    .execute()

  if (followingRows.length === 0) return []

  const result = await getWorks({
    page: 1,
    limit,
    author_ids: followingRows.map((r) => r.following_id),
    sort: 'latest',
  })

  return result.data
}

// =============================================================
// Favorites Functions — "หัวใจ" (แค่บอกว่าชอบ ไม่ใช่เก็บไว้อ่านทีหลัง)
// ⚠️ ชื่อ error/ข้อความเดิมเรียกผิดว่า "บุ๊กมาร์ก" มาตลอด (ก่อน 2026-07-17) — แก้ให้ตรง
//    ความหมายจริงแล้ว ส่วน "เก็บเข้าคลัง" ตัวจริงแยกไปเป็น work_bookmarks ด้านล่าง
// =============================================================

// ---- กดหัวใจผลงาน ----
// 2026-07-29 user เจอว่ากดหัวใจผลงานตัวเองได้ (ปั่นยอดตัวเองได้) — เพิ่มเช็ค author_id
// ⚠️ author_id มาจาก query result (Kysely ประกาศเป็น bigint แต่ node-postgres คืน BIGINT
// เป็น string จริงเสมอ) ต้องครอบ BigInt(...) ก่อนเทียบกับ userId เสมอ ไม่งั้นเทียบผิด — บั๊ก
// pattern เดียวกับที่เจอมาแล้วหลายจุดในโปรเจกต์นี้ (ดู KNOWN_ISSUES.md)
export async function addFavorite(userId: bigint, workUuid: string) {
  const work = await db
    .selectFrom('works')
    .select(['p_id', 'author_id'])
    .where('uuid', '=', workUuid)
    .where('status', '=', 'active')
    .executeTakeFirst()

  if (!work) throw new Error('WORK_NOT_FOUND')
  if (BigInt(work.author_id) === userId) throw new Error('CANNOT_FAVORITE_OWN_WORK')

  const existing = await db
    .selectFrom('work_favorite')
    .select('id')
    .where('user_id', '=', userId)
    .where('p_id', '=', work.p_id)
    .executeTakeFirst()

  if (existing) throw new Error('ALREADY_FAVORITED')

  await db
    .insertInto('work_favorite')
    .values({ user_id: userId, p_id: work.p_id })
    .execute()
}

// ---- เลิกกดหัวใจ ----
export async function removeFavorite(userId: bigint, workUuid: string) {
  const work = await db
    .selectFrom('works')
    .select('p_id')
    .where('uuid', '=', workUuid)
    .where('status', '=', 'active')
    .executeTakeFirst()

  if (!work) throw new Error('WORK_NOT_FOUND')

  const existing = await db
    .selectFrom('work_favorite')
    .select('id')
    .where('user_id', '=', userId)
    .where('p_id', '=', work.p_id)
    .executeTakeFirst()

  if (!existing) throw new Error('NOT_FAVORITED')

  await db
    .deleteFrom('work_favorite')
    .where('user_id', '=', userId)
    .where('p_id', '=', work.p_id)
    .execute()
}

// ---- รายการที่กดหัวใจไว้ ----
export async function getFavorites(userId: bigint, page: number, limit: number) {
  const offset = (page - 1) * limit

  const rows = await db
    .selectFrom('work_favorite as f')
    .innerJoin('works as w', 'w.p_id', 'f.p_id')
    .leftJoin('users as u', 'u.id', 'w.author_id')
    .select([
      'w.uuid',
      'w.title',
      'w.cover_image',
      'w.type',
      'w.publish_status',
      'w.completion_status',
      'w.view_count',
      'u.display_name as author_name',
      'f.created_at as favorited_at',
    ])
    .where('f.user_id', '=', userId)
    .where('w.status', '=', 'active')
    .orderBy('f.created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  const countRow = await db
    .selectFrom('work_favorite as f')
    .innerJoin('works as w', 'w.p_id', 'f.p_id')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('f.user_id', '=', userId)
    .where('w.status', '=', 'active')
    .executeTakeFirstOrThrow()

  const total = Number(countRow.total)

  return {
    data: rows.map((r) => ({ ...r, view_count: String(r.view_count) })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

// =============================================================
// Bookmarks Functions — "เก็บเข้าคลัง" (migration 009)
// ตั้งใจเก็บไว้อ่านทีหลัง คนละความหมายกับ "หัวใจ" ด้านบน — ใช้ตาราง work_bookmarks แยกต่างหาก
// =============================================================

// ---- เก็บผลงานเข้าคลัง ----
// 2026-07-29 user ขอให้กันเหมือนหัวใจ — ห้ามเก็บผลงานตัวเองเข้าคลัง/กดดาวติดตามตัวเอง
// ⚠️ author_id มาจาก query result เป็น string จริงจาก node-postgres แม้ type จะประกาศเป็น
// bigint — ต้องครอบ BigInt(...) ก่อนเทียบกับ userId เสมอ (ดู KNOWN_ISSUES.md)
export async function addBookmark(userId: bigint, workUuid: string) {
  const work = await db
    .selectFrom('works')
    .select(['p_id', 'author_id'])
    .where('uuid', '=', workUuid)
    .where('status', '=', 'active')
    .executeTakeFirst()

  if (!work) throw new Error('WORK_NOT_FOUND')
  if (BigInt(work.author_id) === userId) throw new Error('CANNOT_BOOKMARK_OWN_WORK')

  const existing = await db
    .selectFrom('work_bookmarks')
    .select('id')
    .where('user_id', '=', userId)
    .where('p_id', '=', work.p_id)
    .executeTakeFirst()

  if (existing) throw new Error('ALREADY_BOOKMARKED')

  await db
    .insertInto('work_bookmarks')
    .values({ user_id: userId, p_id: work.p_id })
    .execute()
}

// ---- เอาออกจากคลัง ----
export async function removeBookmark(userId: bigint, workUuid: string) {
  const work = await db
    .selectFrom('works')
    .select('p_id')
    .where('uuid', '=', workUuid)
    .where('status', '=', 'active')
    .executeTakeFirst()

  if (!work) throw new Error('WORK_NOT_FOUND')

  const existing = await db
    .selectFrom('work_bookmarks')
    .select('id')
    .where('user_id', '=', userId)
    .where('p_id', '=', work.p_id)
    .executeTakeFirst()

  if (!existing) throw new Error('NOT_BOOKMARKED')

  await db
    .deleteFrom('work_bookmarks')
    .where('user_id', '=', userId)
    .where('p_id', '=', work.p_id)
    .execute()
}

// ---- "นิยายแนะนำ" ในกล่องเก็บนิยายหน้าโปรไฟล์ (migration 022, 2026-07-29) ----
// สำหรับโปรไฟล์นักอ่านทั่วไป (ไม่ใช่นักเขียน — ดู getAuthorWorks()/setWorkFeatured() ใน
// works.service.ts/writer.service.ts สำหรับฝั่งนักเขียน) ปักหมุดเองได้สูงสุด
// MAX_FEATURED_BOOKMARKS เรื่อง (ดู "จำกัดมากสุดแค่ 2 แถว" ที่ user ขอตอนออกแบบครั้งแรก)
const MAX_FEATURED_BOOKMARKS = 8

export async function setBookmarkFeatured(userId: bigint, workUuid: string, featured: boolean) {
  const work = await db
    .selectFrom('works')
    .select('p_id')
    .where('uuid', '=', workUuid)
    .executeTakeFirst()

  if (!work) throw new Error('WORK_NOT_FOUND')

  const existing = await db
    .selectFrom('work_bookmarks')
    .select('id')
    .where('user_id', '=', userId)
    .where('p_id', '=', work.p_id)
    .executeTakeFirst()

  if (!existing) throw new Error('NOT_BOOKMARKED')

  if (featured) {
    const countRow = await db
      .selectFrom('work_bookmarks')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('user_id', '=', userId)
      .where('featured', '=', true)
      .executeTakeFirstOrThrow()

    if (Number(countRow.count) >= MAX_FEATURED_BOOKMARKS) throw new Error('FEATURED_LIMIT')
  }

  await db
    .updateTable('work_bookmarks')
    .set({ featured })
    .where('user_id', '=', userId)
    .where('p_id', '=', work.p_id)
    .execute()
}

// ---- รายการที่เก็บเข้าคลังไว้ ----
// รูปทรง return ตรงกับ NovelCardData (frontend) — ใช้แสดงในหน้าโปรไฟล์ ("กล่องเก็บนิยาย",
// 2026-07-28) เรียกซ้ำ getWorkCounts() จาก works.service.ts กันเขียน aggregate ซ้ำ
// featuredOnly = true → เฉพาะที่ปักหมุดไว้เป็น "แนะนำ" (แท็บบน, สูงสุด 8 เรื่อง ไม่ต้อง paginate)
// search = ค้นหาจากชื่อเรื่อง (ILIKE) — เพิ่มมาให้ dialog "เลือกนิยายแนะนำ" ค้นหาได้ ไม่ต้องพึ่ง
// แค่ 50 อันแรกที่ดึงมา (2026-07-29 user ขอ)
// sort = เรียงตามตัวนิยายเอง ('latest' = created_at, 'popular' = view_count) — ไม่ใช่เวลาที่
// กดเก็บเข้าคลัง (2026-07-29 user ขอเพิ่ม ให้ตรงความหมายเดียวกับแท็บฝั่งนักเขียน (getAuthorWorks))
export async function getBookmarks(
  userId: bigint,
  page: number,
  limit: number,
  featuredOnly = false,
  search?: string,
  sort: 'latest' | 'popular' = 'latest',
) {
  const offset = (page - 1) * limit

  let dataQuery = db
    .selectFrom('work_bookmarks as b')
    .innerJoin('works as w', 'w.p_id', 'b.p_id')
    .innerJoin('users as u', 'u.id', 'w.author_id')
    .leftJoin('categories as cm', 'cm.id', 'w.category_main')
    .leftJoin('categories as cs', 'cs.id', 'w.category_sub')
    .select([
      'w.p_id',
      'w.uuid',
      'w.title',
      'w.cover_image',
      'w.view_count',
      'w.tags',
      'w.age_rate',
      'u.display_name as author_name',
      'cm.id as category_main_id',
      'cm.name as category_main_name',
      'cs.id as category_sub_id',
      'cs.name as category_sub_name',
      'b.featured',
      'b.created_at as bookmarked_at',
    ])
    .where('b.user_id', '=', userId)
    .where('w.status', '=', 'active')
    .where('w.publish_status', '=', 1)
    .orderBy(sort === 'popular' ? 'w.view_count' : 'w.created_at', 'desc')

  let countQuery = db
    .selectFrom('work_bookmarks as b')
    .innerJoin('works as w', 'w.p_id', 'b.p_id')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('b.user_id', '=', userId)
    .where('w.status', '=', 'active')
    .where('w.publish_status', '=', 1)

  if (featuredOnly) {
    dataQuery = dataQuery.where('b.featured', '=', true)
    countQuery = countQuery.where('b.featured', '=', true)
  }

  if (search) {
    const term = `%${search}%`
    dataQuery = dataQuery.where('w.title', 'ilike', term)
    countQuery = countQuery.where('w.title', 'ilike', term)
  }

  const rows = await dataQuery.limit(limit).offset(offset).execute()
  const countRow = await countQuery.executeTakeFirstOrThrow()

  const total = Number(countRow.total)
  const { episodeCounts, likeCounts } = await getWorkCounts(rows.map((r) => r.p_id))

  return {
    data: rows.map((r) => ({
      uuid: r.uuid,
      title: r.title,
      cover_image: r.cover_image,
      author_name: r.author_name,
      age_rate: r.age_rate ?? 'all',
      tags: r.tags ?? [],
      category_main: r.category_main_id ? { id: String(r.category_main_id), name: r.category_main_name! } : null,
      category_sub: r.category_sub_id ? { id: String(r.category_sub_id), name: r.category_sub_name! } : null,
      // "หมวดหมู่เสริม" = จำนวนแท็กอิสระของเรื่องนี้ (works.tags) นับจริงแทน hardcode 0 (มติ 2026-07-29)
      extra_category_count: (r.tags ?? []).length,
      episode_count: episodeCounts[String(r.p_id)] ?? 0,
      view_count: String(r.view_count),
      like_count: likeCounts[String(r.p_id)] ?? 0,
      is_featured: r.featured,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

// =============================================================
// Episode Bookmarks — "เก็บตอนโปรดไว้ดูทีหลัง" (migration 023, 2026-07-29)
// คนละอันกับ work_bookmarks ด้านบน (เก็บทั้งเรื่อง/ใช้เป็น "ติดตามอัปเดต" ในหน้า Feed) —
// อันนี้เก็บเฉพาะตอนที่ชอบเป็นรายตอน ไม่เกี่ยวกับ follow ทั้งเรื่อง (user ขอแยกต่างหาก)
// =============================================================

async function findEpisodeId(workUuid: string, epNo: number) {
  const work = await db
    .selectFrom('works')
    .select('p_id')
    .where('uuid', '=', workUuid)
    .where('status', '=', 'active')
    .executeTakeFirst()
  if (!work) throw new Error('WORK_NOT_FOUND')

  const episode = await db
    .selectFrom('work_ep')
    .select('ep_id')
    .where('p_id', '=', work.p_id)
    .where('ep_no', '=', epNo)
    .where('status', '=', 'active')
    .executeTakeFirst()
  if (!episode) throw new Error('EPISODE_NOT_FOUND')

  return episode.ep_id
}

export async function addEpisodeBookmark(userId: bigint, workUuid: string, epNo: number) {
  const epId = await findEpisodeId(workUuid, epNo)

  const existing = await db
    .selectFrom('work_ep_bookmarks')
    .select('id')
    .where('user_id', '=', userId)
    .where('ep_id', '=', epId)
    .executeTakeFirst()
  if (existing) throw new Error('EP_ALREADY_BOOKMARKED')

  await db.insertInto('work_ep_bookmarks').values({ user_id: userId, ep_id: epId }).execute()
}

export async function removeEpisodeBookmark(userId: bigint, workUuid: string, epNo: number) {
  const epId = await findEpisodeId(workUuid, epNo)

  const existing = await db
    .selectFrom('work_ep_bookmarks')
    .select('id')
    .where('user_id', '=', userId)
    .where('ep_id', '=', epId)
    .executeTakeFirst()
  if (!existing) throw new Error('EP_NOT_BOOKMARKED')

  await db
    .deleteFrom('work_ep_bookmarks')
    .where('user_id', '=', userId)
    .where('ep_id', '=', epId)
    .execute()
}

// ---- รายการตอนที่เก็บไว้ ----
// ⚠️ ยังไม่มีหน้าแสดงผลจริงฝั่ง frontend ตอนนี้ (user ขอแค่ปุ่มบันทึก/เอาออกในหน้าอ่านก่อน
// — ดู KNOWN_ISSUES.md) endpoint นี้เตรียมไว้ให้พร้อมใช้ทันทีที่ทำหน้ารายการจริง
export async function getEpisodeBookmarks(userId: bigint, page: number, limit: number) {
  const offset = (page - 1) * limit

  const rows = await db
    .selectFrom('work_ep_bookmarks as b')
    .innerJoin('work_ep as ep', 'ep.ep_id', 'b.ep_id')
    .innerJoin('works as w', 'w.p_id', 'ep.p_id')
    .innerJoin('users as u', 'u.id', 'w.author_id')
    .select([
      'w.uuid',
      'w.title',
      'w.cover_image',
      'u.display_name as author_name',
      'ep.ep_no',
      'ep.ep_name',
      'ep.episode_label',
      'b.created_at as bookmarked_at',
    ])
    .where('b.user_id', '=', userId)
    .where('w.status', '=', 'active')
    .orderBy('b.created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  const countRow = await db
    .selectFrom('work_ep_bookmarks as b')
    .innerJoin('work_ep as ep', 'ep.ep_id', 'b.ep_id')
    .innerJoin('works as w', 'w.p_id', 'ep.p_id')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('b.user_id', '=', userId)
    .where('w.status', '=', 'active')
    .executeTakeFirstOrThrow()

  const total = Number(countRow.total)

  return {
    data: rows,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

// ---- GET /users/:uuid/bookmarks (public, เช็ค privacy) ----
// เจ้าของโปรไฟล์ (viewerId ตรงกับ targetUserId) เห็นของตัวเองเสมอไม่ว่าตั้งค่าไว้ยังไง —
// การซ่อนมีผลกับ "คนอื่น" เท่านั้น (มติ 2026-07-29 ตอนออกแบบ toggle นี้)
export async function getPublicBookmarks(
  targetUserId: bigint,
  viewerId: bigint | null,
  page: number,
  limit: number,
  featuredOnly = false,
  search?: string,
  sort: 'latest' | 'popular' = 'latest',
) {
  // ⚠️ targetUserId มาจาก query result (Kysely ประกาศเป็น bigint แต่ node-postgres คืน BIGINT
  // เป็น string จริงเสมอ) ต้องครอบ BigInt(...) ก่อนเทียบกับ viewerId (bigint จริงจาก JWT payload)
  // ไม่งั้นเทียบผิดเสมอ (string !== bigint ใน JS ไม่มีทาง === กัน) — ดู KNOWN_ISSUES.md เรื่องนี้
  const isOwner = viewerId !== null && viewerId === BigInt(targetUserId)

  if (!isOwner) {
    const target = await db
      .selectFrom('users')
      .select('bookmarks_public')
      .where('id', '=', targetUserId)
      .executeTakeFirstOrThrow()

    if (!target.bookmarks_public) {
      return {
        data: [],
        pagination: { page, limit, total: 0, pages: 0 },
        hidden: true,
      }
    }
  }

  const result = await getBookmarks(targetUserId, page, limit, featuredOnly, search, sort)
  return { ...result, hidden: false }
}

// =============================================================
// Reading History
// =============================================================

// ---- ประวัติการอ่าน — จัดกลุ่มตามความล่าสุด (ล่าสุด/สัปดาห์นี้/นานกว่านั้น) ----
// ที่มาข้อมูล: work_ep_views (มี schema อยู่แล้วแต่ไม่เคยมีใครเขียนลงจนกระทั่งตอนนี้ —
// ดู works.service.ts getEpisodeContent() ที่เพิ่ง insert เข้าไปให้)
// แสดงแค่ "เรื่องล่าสุดที่อ่าน" ต่อเรื่อง ไม่ใช่ทุกครั้งที่อ่าน (group by p_id เอา MAX เวลา)
// แบ่งกลุ่ม: ล่าสุด = ภายใน 1 วัน, สัปดาห์นี้ = เกิน 1 วันถึง 7 วัน, นานกว่านั้น = เกิน 7 วัน
// จำนวนงานที่อ่านทั้งหมดของ user ปกติไม่เยอะมาก เลยดึงมาทั้งหมดครั้งเดียวแล้วแบ่งกลุ่ม+
// ตัดหน้าใน JS แทนที่จะ query 3 รอบแยกกัน (pagination ใช้กับกลุ่ม "นานกว่านั้น" เท่านั้น
// ตามที่ user ขอ — สองกลุ่มแรกโชว์ครบไม่ตัดหน้า)
export async function getReadingHistory(userId: bigint, olderPage: number, olderLimit: number) {
  const latestPerWork = db
    .selectFrom('work_ep_views')
    .select(['p_id', ({ fn }) => fn.max('created_at').as('last_read_at')])
    .where('user_id', '=', userId)
    .groupBy('p_id')
    .as('lv')

  const rows = await db
    .selectFrom(latestPerWork)
    .innerJoin('works as w', 'w.p_id', 'lv.p_id')
    .innerJoin('users as u', 'u.id', 'w.author_id')
    .leftJoin('categories as cm', 'cm.id', 'w.category_main')
    .leftJoin('categories as cs', 'cs.id', 'w.category_sub')
    .select([
      'w.p_id',
      'w.uuid',
      'w.title',
      'w.description',
      'w.cover_image',
      'w.tags',
      'w.view_count',
      'u.display_name as author_display_name',
      'cm.id as category_main_id',
      'cm.name as category_main_name',
      'cs.id as category_sub_id',
      'cs.name as category_sub_name',
      'lv.last_read_at',
    ])
    .where('w.status', '=', 'active')
    .orderBy('lv.last_read_at', 'desc')
    .execute()

  // นับไลค์/คอมเม้นแบบ batch (เหมือน pattern getWorkCounts ใน works.service.ts)
  const pIds = rows.map((r) => r.p_id)
  const likeCounts: Record<string, number> = {}
  const commentCounts: Record<string, number> = {}

  if (pIds.length > 0) {
    const [likes, comments] = await Promise.all([
      db.selectFrom('work_favorite')
        .select(['p_id', ({ fn }) => fn.countAll<string>().as('count')])
        .where('p_id', 'in', pIds)
        .groupBy('p_id')
        .execute(),
      db.selectFrom('work_comments')
        .select(['work_id', ({ fn }) => fn.countAll<string>().as('count')])
        .where('work_id', 'in', pIds)
        .where('parent_id', 'is', null)
        .where('status', '=', 'active')
        .groupBy('work_id')
        .execute(),
    ])
    for (const l of likes) likeCounts[String(l.p_id)] = Number(l.count)
    for (const c of comments) commentCounts[String(c.work_id)] = Number(c.count)
  }

  const mapped = rows.map((r) => ({
    uuid: r.uuid,
    title: r.title,
    description: r.description,
    cover_image: r.cover_image,
    tags: r.tags ?? [],
    view_count: String(r.view_count),
    like_count: likeCounts[String(r.p_id)] ?? 0,
    comment_count: commentCounts[String(r.p_id)] ?? 0,
    author: { display_name: r.author_display_name },
    category_main: r.category_main_id ? { id: String(r.category_main_id), name: r.category_main_name } : null,
    category_sub: r.category_sub_id ? { id: String(r.category_sub_id), name: r.category_sub_name } : null,
    last_read_at: r.last_read_at,
  }))

  const now = Date.now()
  const oneDayMs = 24 * 60 * 60 * 1000
  const sevenDaysMs = 7 * oneDayMs

  const recent = mapped.filter((r) => now - new Date(r.last_read_at).getTime() < oneDayMs)
  const thisWeek = mapped.filter((r) => {
    const age = now - new Date(r.last_read_at).getTime()
    return age >= oneDayMs && age < sevenDaysMs
  })
  const older = mapped.filter((r) => now - new Date(r.last_read_at).getTime() >= sevenDaysMs)

  const olderOffset = (olderPage - 1) * olderLimit
  const olderPageRows = older.slice(olderOffset, olderOffset + olderLimit)

  return {
    recent,
    this_week: thisWeek,
    older: olderPageRows,
    older_pagination: {
      page: olderPage,
      limit: olderLimit,
      total: older.length,
      pages: Math.max(1, Math.ceil(older.length / olderLimit)),
    },
  }
}

// ---- "อ่านล่าสุด" (หน้า Feed, 2026-07-29) ----
// แถวสั้นๆ (ไม่แบ่งกลุ่มเหมือน getReadingHistory ด้านบน — หน้านั้นคือหน้าประวัติเต็ม หน้านี้
// แค่ teaser row) เอาแค่ตอนที่อ่านล่าสุดสุดของแต่ละเรื่อง พร้อมเลขตอน (getReadingHistory เดิม
// group ด้วย MAX(created_at) เฉยๆ ไม่ได้ join กลับมาเอา ep_no ของแถวนั้น — ใช้ DISTINCT ON แทน
// เพื่อได้ทั้ง created_at และ ep_no ของ "แถวล่าสุด" จริงๆ ในทีเดียว)
export async function getRecentlyReadFeed(userId: bigint, limit: number) {
  const latestView = db
    .selectFrom('work_ep_views')
    .distinctOn('p_id')
    .select(['p_id', 'ep_no', 'created_at'])
    .where('user_id', '=', userId)
    .orderBy('p_id')
    .orderBy('created_at', 'desc')
    .as('lv')

  const rows = await db
    .selectFrom(latestView)
    .innerJoin('works as w', 'w.p_id', 'lv.p_id')
    .innerJoin('users as u', 'u.id', 'w.author_id')
    .leftJoin('work_ep as ep', (join) =>
      join.onRef('ep.p_id', '=', 'lv.p_id').onRef('ep.ep_no', '=', 'lv.ep_no')
    )
    .select([
      'w.uuid',
      'w.title',
      'w.cover_image',
      'u.display_name as author_name',
      'lv.ep_no',
      'lv.created_at as read_at',
      'ep.ep_name',
      'ep.episode_label',
    ])
    .where('w.status', '=', 'active')
    .orderBy('lv.created_at', 'desc')
    .limit(limit)
    .execute()

  return rows.map((r) => ({
    uuid: r.uuid,
    title: r.title,
    cover_image: r.cover_image,
    author_name: r.author_name,
    ep_no: r.ep_no,
    ep_name: r.ep_name,
    episode_label: r.episode_label,
    read_at: r.read_at,
  }))
}

// ---- "เรื่องที่กดดาว" (หน้า Feed, 2026-07-29) ----
// 2026-07-29 มติแก้: "ดาว" เป็น work_bookmarks ตัวเดียวกับ "เก็บเข้าคลัง" เดิม (แค่เปลี่ยนไอคอน
// เป็นดาวที่หน้ารายละเอียด/หน้าอ่าน — ดู novel-hero-section.tsx/episode-reader-header.tsx) ส่วนนี้
// คือ logic ใหม่ที่เพิ่มมา: โชว์เฉพาะเรื่องที่บุ๊คมาร์คไว้ "และ" มีตอนใหม่ที่ยังไม่ได้อ่าน
// (ตอนล่าสุดที่ publish แล้ว ep_no > เลขตอนล่าสุดที่ user คนนี้เคยอ่าน หรือไม่เคยอ่านเลย) —
// อ่านจนถึงตอนนั้นแล้วจะหายไปจากรายการเอง (ไม่ query แถวนี้อีกเพราะเงื่อนไข ep_no ไม่ผ่าน)
// ป้ายกำกับ "ใหม่" (is_new) = ตอนนั้น publish มาไม่เกิน 3 วัน (ค่านี้เดายืดหยุ่นเอาเอง user ไม่ได้
// กำหนดเลขตายตัว — ดู KNOWN_ISSUES.md)
const STARRED_NEW_BADGE_DAYS = 3

export async function getStarredUpdatesFeed(userId: bigint, limit: number) {
  // ตอนล่าสุดที่ publish แล้วของแต่ละเรื่อง (เงื่อนไข publish เดียวกับ getWorkByUuid/getEpisodeContent)
  const latestEp = db
    .selectFrom('work_ep')
    .distinctOn('p_id')
    .select(['p_id', 'ep_no', 'ep_name', 'episode_label', 'created_at'])
    .where('status', '=', 'active')
    .where((eb) =>
      eb.or([
        eb('publish_status', '=', 'now'),
        eb.and([eb('publish_status', '=', 'schedule'), eb('schedule_datetime', '<=', new Date())]),
      ])
    )
    .orderBy('p_id')
    .orderBy('ep_no', 'desc')
    .as('le')

  // เลขตอนล่าสุดที่ user คนนี้เคยอ่านของแต่ละเรื่อง (ไม่เจอแถว = ไม่เคยอ่านเลย)
  const lastRead = db
    .selectFrom('work_ep_views')
    .select(['p_id', ({ fn }) => fn.max('ep_no').as('max_ep_no')])
    .where('user_id', '=', userId)
    .groupBy('p_id')
    .as('lr')

  const rows = await db
    .selectFrom('work_bookmarks as b')
    .innerJoin('works as w', 'w.p_id', 'b.p_id')
    .innerJoin('users as u', 'u.id', 'w.author_id')
    .innerJoin(latestEp, 'le.p_id', 'b.p_id')
    .leftJoin(lastRead, 'lr.p_id', 'b.p_id')
    .select([
      'w.uuid',
      'w.title',
      'w.cover_image',
      'u.display_name as author_name',
      'le.ep_no',
      'le.ep_name',
      'le.episode_label',
      'le.created_at as ep_published_at',
    ])
    .where('b.user_id', '=', userId)
    .where('w.status', '=', 'active')
    .where('w.publish_status', '=', 1)
    .where((eb) => eb.or([eb('lr.max_ep_no', 'is', null), eb('le.ep_no', '>', eb.ref('lr.max_ep_no'))]))
    .orderBy('le.created_at', 'desc')
    .limit(limit)
    .execute()

  const now = Date.now()
  const newBadgeMs = STARRED_NEW_BADGE_DAYS * 24 * 60 * 60 * 1000

  return rows.map((r) => ({
    uuid: r.uuid,
    title: r.title,
    cover_image: r.cover_image,
    author_name: r.author_name,
    ep_no: r.ep_no,
    ep_name: r.ep_name,
    episode_label: r.episode_label,
    ep_published_at: r.ep_published_at,
    is_new: now - new Date(r.ep_published_at).getTime() <= newBadgeMs,
  }))
}

// =============================================================
// Comment Functions
// =============================================================

// ---- ดู comments ของผลงาน ----
// epNo = undefined → ดูทั้งหมด (work + ทุก episode รวมกัน)
// epNo = number   → ดูเฉพาะ episode นั้น
export async function getComments(
  workUuid: string,
  page: number,
  limit: number,
  epNo?: number,
  viewerId?: bigint | null
) {
  const work = await db
    .selectFrom('works')
    .select(['p_id', 'author_id'])
    .where('uuid', '=', workUuid)
    .where('status', '=', 'active')
    .executeTakeFirst()

  if (!work) throw new Error('WORK_NOT_FOUND')

  // ถ้าระบุ ep_no → หา ep_id เพื่อกรอง
  let filterEpId: bigint | undefined
  if (epNo !== undefined) {
    const ep = await db
      .selectFrom('work_ep')
      .select('ep_id')
      .where('p_id', '=', work.p_id)
      .where('ep_no', '=', epNo)
      .where('status', '=', 'active')
      .executeTakeFirst()

    if (!ep) throw new Error('EPISODE_NOT_FOUND')
    filterEpId = ep.ep_id
  }

  const offset = (page - 1) * limit

  // ดึง top-level comments (parent_id IS NULL)
  // left join work_ep เพื่อเอา ep_no, ep_name ไปแสดง label "จากตอนที่ X"
  let query = db
    .selectFrom('work_comments as c')
    .innerJoin('users as u', 'u.id', 'c.user_id')
    .leftJoin('work_ep as ep', 'ep.ep_id', 'c.episode_id')
    .select([
      'c.id',
      'c.content',
      'c.likes_count',
      'c.episode_id',
      'c.created_at',
      'c.user_id',
      'u.uuid as user_uuid',
      'u.display_name',
      'u.user_img',
      'ep.ep_no',
      'ep.ep_name',
    ])
    .where('c.work_id', '=', work.p_id)
    .where('c.parent_id', 'is', null)
    .where('c.status', '=', 'active')

  if (filterEpId !== undefined) {
    query = query.where('c.episode_id', '=', filterEpId)
  }

  // ถ้าไม่กรอง episode → เรียงตาม likes_count (engage สูงสุดก่อน)
  // ถ้ากรอง episode → เรียงตามเวลาล่าสุด
  const comments = await (
    filterEpId === undefined
      ? query.orderBy('c.likes_count', 'desc').orderBy('c.created_at', 'desc')
      : query.orderBy('c.created_at', 'desc')
  )
    .limit(limit)
    .offset(offset)
    .execute()

  // ดึง replies ทั้งหมดใน 1 query แล้วจัดกลุ่มใน JS
  // ทำไมไม่ loop ดึงทีละ comment?
  // เพราะ N+1 query — ถ้ามี 20 comments = 21 queries ซึ่งช้ามาก
  const commentIds = comments.map((c) => c.id)
  const repliesMap: Record<string, any[]> = {}

  if (commentIds.length > 0) {
    const replies = await db
      .selectFrom('work_comments as c')
      .innerJoin('users as u', 'u.id', 'c.user_id')
      .select([
        'c.id',
        'c.parent_id',
        'c.content',
        'c.likes_count',
        'c.created_at',
        'c.user_id',
        'u.uuid as user_uuid',
        'u.display_name',
        'u.user_img',
      ])
      .where('c.parent_id', 'in', commentIds)
      .where('c.status', '=', 'active')
      .orderBy('c.created_at', 'asc')
      .execute()

    for (const reply of replies) {
      const key = String(reply.parent_id)
      if (!repliesMap[key]) repliesMap[key] = []
      repliesMap[key].push({
        id:          String(reply.id),
        content:     reply.content,
        likes_count: reply.likes_count,
        created_at:  reply.created_at,
        user: {
          uuid:         reply.user_uuid,
          display_name: reply.display_name,
          user_img:     reply.user_img,
          is_author:    reply.user_id === work.author_id,
        },
      })
    }
  }

  // ---- สถานะไลค์ของ viewer ปัจจุบัน (ถ้าล็อกอินอยู่) ----
  // ดึงทีเดียวรวมทั้ง top-level comment + reply กัน N+1 query
  const likedIds = new Set<string>()
  if (viewerId) {
    const allIds = [...comments.map((c) => c.id), ...Object.values(repliesMap).flat().map((r) => BigInt(r.id))]
    if (allIds.length > 0) {
      const likedRows = await db
        .selectFrom('comment_likes')
        .select('comment_id')
        .where('user_id', '=', viewerId)
        .where('comment_id', 'in', allIds)
        .execute()
      for (const row of likedRows) likedIds.add(String(row.comment_id))
    }
  }

  let countQuery = db
    .selectFrom('work_comments')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('work_id', '=', work.p_id)
    .where('parent_id', 'is', null)
    .where('status', '=', 'active')

  if (filterEpId !== undefined) {
    countQuery = countQuery.where('episode_id', '=', filterEpId)
  }

  const countRow = await countQuery.executeTakeFirstOrThrow()
  const total = Number(countRow.total)

  return {
    data: comments.map((c) => ({
      id:          String(c.id),
      content:     c.content,
      likes_count: c.likes_count,
      is_liked:    likedIds.has(String(c.id)),
      created_at:  c.created_at,
      // from_episode = null หมายถึง work-level comment
      // มีค่า = comment จาก episode นั้น (แสดง label ได้)
      from_episode: c.episode_id
        ? { ep_no: c.ep_no, ep_name: c.ep_name }
        : null,
      user: {
        uuid:         c.user_uuid,
        display_name: c.display_name,
        user_img:     c.user_img,
        is_author:    c.user_id === work.author_id,
      },
      replies: (repliesMap[String(c.id)] ?? []).map((r) => ({ ...r, is_liked: likedIds.has(r.id) })),
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

// ---- โพสต์ comment หรือ reply ----
// ถ้าส่ง parent_id มา = reply, ไม่ส่ง = top-level comment
// ถ้าส่ง ep_no มา = comment จาก episode นั้น, ไม่ส่ง = work-level comment
// รองรับแค่ 1 ชั้น (ห้าม reply ซ้อน reply)
export async function createComment(
  userId: bigint,
  workUuid: string,
  content: string,
  parentId?: bigint,
  epNo?: number
) {
  // schema validation (works.routes.ts) เช็คแค่ minLength:1 ซึ่งนับ whitespace เป็น
  // ตัวอักษรด้วย — เช็คซ้ำที่นี่กันคอมเม้นช่องว่างล้วนๆ หลุดผ่านตอนยิง API ตรงๆ (ไม่ผ่าน UI)
  const trimmedContent = content.trim()
  if (!trimmedContent) throw new Error('EMPTY_CONTENT')

  const work = await db
    .selectFrom('works')
    .select(['p_id', 'author_id', 'uuid', 'title'])
    .where('uuid', '=', workUuid)
    .where('status', '=', 'active')
    .executeTakeFirst()

  if (!work) throw new Error('WORK_NOT_FOUND')

  // ถ้าระบุ ep_no → หา ep_id
  let episodeId: bigint | null = null
  let epName: string | null = null
  if (epNo !== undefined) {
    const ep = await db
      .selectFrom('work_ep')
      .select(['ep_id', 'ep_name'])
      .where('p_id', '=', work.p_id)
      .where('ep_no', '=', epNo)
      .where('status', '=', 'active')
      .executeTakeFirst()

    if (!ep) throw new Error('EPISODE_NOT_FOUND')
    episodeId = ep.ep_id
    epName = ep.ep_name
  }

  // ถ้าเป็น reply — ตรวจว่า parent มีอยู่จริงและเป็น top-level
  let parentOwnerId: bigint | null = null
  if (parentId) {
    const parent = await db
      .selectFrom('work_comments')
      .select(['id', 'user_id', 'parent_id'])
      .where('id', '=', parentId)
      .where('status', '=', 'active')
      .executeTakeFirst()

    if (!parent) throw new Error('COMMENT_NOT_FOUND')
    if (parent.parent_id !== null) throw new Error('NESTED_REPLY_NOT_ALLOWED')
    parentOwnerId = parent.user_id
  }

  const comment = await db
    .insertInto('work_comments')
    .values({
      work_id:     work.p_id,
      episode_id:  episodeId,
      user_id:     userId,
      parent_id:   parentId ?? null,
      content:     trimmedContent,
      likes_count: 0,
      status:      'active',
    })
    .returning(['id', 'content', 'created_at'])
    .executeTakeFirstOrThrow()

  // สร้าง notification
  // reply → แจ้งเจ้าของ comment เดิม (ถ้าไม่ใช่ตัวเอง)
  // top-level → แจ้ง author ของผลงาน (ถ้าไม่ใช่ตัวเอง)
  const refUrl = epNo !== undefined
    ? `/works/${work.uuid}?ep=${epNo}`
    : `/works/${work.uuid}`

  // BigInt() ครอบก่อนเทียบเสมอ — pg คืน BIGINT เป็น string ไม่ใช่ native bigint
  if (parentId && parentOwnerId && BigInt(parentOwnerId) !== userId) {
    await db
      .insertInto('notifications')
      .values({
        user_id: parentOwnerId,
        type:    'reply',
        message: epNo !== undefined
          ? `มีคนตอบกลับความคิดเห็นของคุณใน "${work.title}" ตอนที่ ${epNo}`
          : `มีคนตอบกลับความคิดเห็นของคุณใน "${work.title}"`,
        ref_url: refUrl,
        is_read: false,
      })
      .execute()
  } else if (!parentId && BigInt(work.author_id) !== userId) {
    await db
      .insertInto('notifications')
      .values({
        user_id: work.author_id,
        type:    'comment',
        message: epNo !== undefined
          ? `มีความคิดเห็นใหม่ใน "${work.title}" ตอนที่ ${epNo} — ${epName}`
          : `มีความคิดเห็นใหม่ใน "${work.title}"`,
        ref_url: refUrl,
        is_read: false,
      })
      .execute()
  }

  return {
    ...comment,
    id:         String(comment.id),
    episode_id: episodeId ? String(episodeId) : null,
  }
}

// ---- ลบ comment (soft delete) ----
export async function deleteComment(userId: bigint, commentId: bigint) {
  const comment = await db
    .selectFrom('work_comments')
    .select(['id', 'user_id'])
    .where('id', '=', commentId)
    .where('status', '=', 'active')
    .executeTakeFirst()

  if (!comment) throw new Error('COMMENT_NOT_FOUND')
  if (BigInt(comment.user_id) !== userId) throw new Error('NOT_YOUR_COMMENT')

  await db
    .updateTable('work_comments')
    .set({ status: 'deleted', updated_at: new Date() })
    .where('id', '=', commentId)
    .execute()
}

// =============================================================
// Report Functions (migration 025) — แทนปุ่ม "รายงาน" ที่เดิม mock devToast.info()
// อยู่ 3 จุด (novel-comments-section.tsx, episode-comments-section.tsx,
// novel-hero-section.tsx) — polymorphic target_type ('comment' | 'work')
//
// migration 032: เพิ่ม category (dropdown แทนข้อความเปล่าล้วน) — หมวด 'content_error' ต้อง
// routing เข้าคิว "รายงานที่ได้รับ" ของนักเขียนเจ้าของผลงานแทนคิวแอดมิน (ที่เหลือเข้าแอดมิน
// เหมือนเดิม) เลยต้อง resolve+snapshot work_author_id ไว้ตอนสร้างเสมอ ไม่ว่า target_type จะเป็น
// 'work' (ใช้ author_id ตรงๆ) หรือ 'comment' (ต้อง join ผ่าน work_comments.work_id ->
// works.author_id เพิ่ม เพราะ ownerId ของ comment คือคนคอมเมนต์ ไม่ใช่เจ้าของผลงาน)
// =============================================================

// ---- รายงาน comment, work, หรือ user ----
// targetRef: comment → comment id (ตัวเลขล้วน), work → work uuid, user → user uuid
// (2026-08-18 เพิ่ม target_type='user' — target_id = users.id ตรงๆ ไม่มี work_author_id เกี่ยวข้อง
// เพราะไม่ใช่รายงานเนื้อหาในผลงานใคร เลยไม่เด้งเข้าคิวนักเขียนไม่ว่าจะเลือกหมวดไหนก็ตาม)
export async function reportContent(
  userId: bigint,
  targetType: 'comment' | 'work' | 'user',
  targetRef: string,
  category: ReportCategory,
  reason: string,
) {
  if (!isValidReportCategory(category)) throw new Error('INVALID_CATEGORY')

  const trimmedReason = reason.trim()
  if (!trimmedReason) throw new Error('EMPTY_REASON')

  let targetId: bigint
  let ownerId: bigint
  let workAuthorId: bigint | undefined

  if (targetType === 'comment') {
    if (!/^[0-9]+$/.test(targetRef)) throw new Error('COMMENT_NOT_FOUND')

    const comment = await db
      .selectFrom('work_comments as c')
      .innerJoin('works as w', 'w.p_id', 'c.work_id')
      .select(['c.id', 'c.user_id', 'w.author_id as work_author_id'])
      .where('c.id', '=', BigInt(targetRef))
      .where('c.status', '=', 'active')
      .executeTakeFirst()

    if (!comment) throw new Error('COMMENT_NOT_FOUND')
    targetId = comment.id
    ownerId = comment.user_id
    workAuthorId = comment.work_author_id
  } else if (targetType === 'work') {
    const work = await db
      .selectFrom('works')
      .select(['p_id', 'author_id'])
      .where('uuid', '=', targetRef)
      .where('status', '=', 'active')
      .executeTakeFirst()

    if (!work) throw new Error('WORK_NOT_FOUND')
    targetId = work.p_id
    ownerId = work.author_id
    workAuthorId = work.author_id
  } else {
    const target = await db
      .selectFrom('users')
      .select('id')
      .where('uuid', '=', targetRef)
      .executeTakeFirst()

    if (!target) throw new Error('USER_NOT_FOUND')
    targetId = target.id
    ownerId = target.id
    workAuthorId = undefined
  }

  if (BigInt(ownerId) === userId) throw new Error('CANNOT_REPORT_OWN_CONTENT')

  const existing = await db
    .selectFrom('content_reports')
    .select('id')
    .where('target_type', '=', targetType)
    .where('target_id', '=', targetId)
    .where('reported_by', '=', userId)
    .where('status', '=', 'pending')
    .executeTakeFirst()

  if (existing) throw new Error('ALREADY_REPORTED')

  const row = await db
    .insertInto('content_reports')
    .values({
      target_type:     targetType,
      target_id:       targetId,
      reported_by:     userId,
      reason:          trimmedReason,
      category,
      work_author_id:  workAuthorId,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow()

  return { id: String(row.id) }
}

// =============================================================
// Like Functions
// =============================================================

// ---- Like comment ----
export async function likeComment(userId: bigint, commentId: bigint) {
  const comment = await db
    .selectFrom('work_comments')
    .select('id')
    .where('id', '=', commentId)
    .where('status', '=', 'active')
    .executeTakeFirst()

  if (!comment) throw new Error('COMMENT_NOT_FOUND')

  const existing = await db
    .selectFrom('comment_likes')
    .select('id')
    .where('user_id', '=', userId)
    .where('comment_id', '=', commentId)
    .executeTakeFirst()

  if (existing) throw new Error('ALREADY_LIKED')

  // transaction: insert like + increment likes_count พร้อมกัน
  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('comment_likes')
      .values({ comment_id: commentId, user_id: userId })
      .execute()

    await trx
      .updateTable('work_comments')
      .set({ likes_count: sql<number>`likes_count + 1` })
      .where('id', '=', commentId)
      .execute()
  })
}

// ---- Unlike comment ----
export async function unlikeComment(userId: bigint, commentId: bigint) {
  const existing = await db
    .selectFrom('comment_likes')
    .select('id')
    .where('user_id', '=', userId)
    .where('comment_id', '=', commentId)
    .executeTakeFirst()

  if (!existing) throw new Error('NOT_LIKED')

  // transaction: ลบ like + decrement likes_count
  // ใช้ GREATEST(likes_count - 1, 0) ป้องกัน likes_count ติดลบ
  // (กรณี race condition หรือ data ผิดพลาด)
  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom('comment_likes')
      .where('user_id', '=', userId)
      .where('comment_id', '=', commentId)
      .execute()

    await trx
      .updateTable('work_comments')
      .set({ likes_count: sql<number>`GREATEST(likes_count - 1, 0)` })
      .where('id', '=', commentId)
      .execute()
  })
}

// =============================================================
// Notification Functions
// =============================================================

// ---- รายการแจ้งเตือน ----
export async function getNotifications(userId: bigint, page: number, limit: number) {
  const offset = (page - 1) * limit

  const rows = await db
    .selectFrom('notifications')
    .select(['id', 'type', 'message', 'ref_url', 'is_read', 'created_at'])
    .where('user_id', '=', userId)
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  const totalRow = await db
    .selectFrom('notifications')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('user_id', '=', userId)
    .executeTakeFirstOrThrow()

  const unreadRow = await db
    .selectFrom('notifications')
    .select(({ fn }) => fn.countAll<string>().as('count'))
    .where('user_id', '=', userId)
    .where('is_read', '=', false)
    .executeTakeFirstOrThrow()

  const total = Number(totalRow.total)

  return {
    data:         rows.map((r) => ({ ...r, id: String(r.id) })),
    unread_count: Number(unreadRow.count),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  }
}

// ---- Mark notification เดียวเป็น read ----
export async function markAsRead(userId: bigint, notificationId: bigint) {
  const notif = await db
    .selectFrom('notifications')
    .select('id')
    .where('id', '=', notificationId)
    .where('user_id', '=', userId)
    .executeTakeFirst()

  if (!notif) throw new Error('NOTIFICATION_NOT_FOUND')

  await db
    .updateTable('notifications')
    .set({ is_read: true })
    .where('id', '=', notificationId)
    .execute()
}

// ---- Mark ทั้งหมดเป็น read ----
export async function markAllAsRead(userId: bigint) {
  await db
    .updateTable('notifications')
    .set({ is_read: true })
    .where('user_id', '=', userId)
    .where('is_read', '=', false)
    .execute()
}
