// =============================================================
// Novel Platform — Writer Service
// วางไว้ที่: apps/api/src/modules/writer/writer.service.ts
// =============================================================

import { db } from '../../db'
import { uuidv7 } from 'uuidv7'
import { sql, type Transaction } from 'kysely'
import {
  uploadFile,
  deleteFile,
  getPublicUrl,
  getKeyFromUrl,
  coverKey,
  episodeImageKey,
  bankDocumentKey,
  getExtension,
  isAllowedImageType,
} from '../../lib/r2'
import { processImage } from '../../lib/image'
import { isValidBankCode } from '../../lib/thai-banks'
import type { NovelBlock, DB } from '../../db/types'
import { clearAudioTimestamps, enqueueAutoTtsForEpisode, getTtsSourceHash, invalidateTtsForEpisode, preserveAudioTimestamps } from '../tts/tts.service'

// =============================================================
// Input Types
// =============================================================

export type CreateWorkInput = {
  title:             string
  original_title?:   string
  description?:      string
  type:              'manga' | 'novel'
  category_main?:    number
  category_sub?:     number
  origin_type?:      1 | 2 | 3 | 4
  age_rate?:         'all' | '18+'
  is_translated?:    boolean
  tags?:             string[]
  is_one_shot?:      boolean
  completion_status?: 'ongoing' | 'completed' | 'hiatus'
}

export type UpdateWorkInput = {
  title?:             string
  original_title?:    string | null
  description?:       string | null
  synopsis?:          object | null
  category_main?:     number | null
  category_sub?:      number | null
  origin_type?:       1 | 2 | 3 | 4 | null
  age_rate?:          'all' | '18+' | null
  is_translated?:     boolean
  tags?:              string[]
  is_one_shot?:       boolean
  completion_status?: 'ongoing' | 'completed' | 'hiatus' | null
  publish_status?:    0 | 1
}

export type CreateEpisodeInput = {
  ep_name:            string
  ep_no?:             number   // ถ้าไม่ส่งมา = auto-assign (max ที่มีอยู่ + 1) เหมือนเดิม
  ep_price?:          string   // "0" = ฟรี, "10" = 10 เหรียญ
  publish_status?:    'now' | 'schedule' | 'hide'
  schedule_datetime?: Date
  lock_duration_days?: number
  image_protection?:  boolean
  // สำหรับ novel: ส่ง blocks มาพร้อมกันได้เลย (optional)
  ep_content?:        NovelBlock[]
  // migration 014 — คำเรียกตอนเป็นค่าต่อตอนแล้ว (ไม่ใช่ระดับเรื่อง) ถ้าไม่ส่งมา (undefined)
  // จะ inherit จากตอนล่าสุด (ep_no สูงสุด) ของเรื่องนี้อัตโนมัติ — ส่ง null มาตรงๆ = ไม่มีคำเรียก
  episode_label?:     string | null
  reader_message?:    string | null   // migration 011: "ข้อความถึงนักอ่าน"
}

export type UpdateEpisodeInput = {
  ep_name?:           string
  ep_no?:             number   // migration 010 — แก้เลขลำดับตอนได้ (เริ่มจาก 0 ได้ ห้ามซ้ำ)
  ep_price?:          string
  publish_status?:    'now' | 'schedule' | 'hide'
  schedule_datetime?: Date | null
  lock_duration_days?: number | null
  image_protection?:  boolean
  ep_content?:        NovelBlock[]  // novel เท่านั้น
  episode_label?:     string | null   // migration 014 — แก้คำเรียกของตอนนี้ตอนเดียว (ไม่กระทบตอนอื่น)
  reader_message?:    string | null   // migration 011: "ข้อความถึงนักอ่าน"
}

// =============================================================
// Work Functions
// =============================================================

// ---- ดูรายการผลงานของตัวเอง ----
export async function getMyWorks(userId: bigint) {
  const rows = await db
    .selectFrom('works as c')
    .leftJoin('categories as cm', 'cm.id', 'c.category_main')
    .leftJoin('categories as cs', 'cs.id', 'c.category_sub')
    .select([
      'c.p_id',
      'c.uuid',
      'c.title',
      'c.cover_image',
      'c.type',
      'c.age_rate',
      'c.publish_status',
      'c.completion_status',
      'c.view_count',
      'c.tags',
      'c.created_at',
      'c.updated_at',
      'cm.id as category_main_id',
      'cm.name as category_main_name',
      'cs.id as category_sub_id',
      'cs.name as category_sub_name',
    ])
    .where('c.author_id', '=', userId)
    .where('c.status', '=', 'active')
    .orderBy('c.created_at', 'desc')
    .execute()

  // ดึง episode count และยอดขาย (จาก ep_shop) แยกแล้ว map เข้าหากัน
  // (ทำ subquery แยกดีกว่า เพราะ Kysely correlated subquery กับ GROUP BY อาจซับซ้อน)
  const pIds = rows.map((r) => r.p_id)
  let episodeCounts: Record<string, number> = {}
  let salesByWork: Record<string, number> = {}

  if (pIds.length > 0) {
    const counts = await db
      .selectFrom('work_ep')
      .select(['p_id', ({ fn }) => fn.countAll<string>().as('count')])
      .where('p_id', 'in', pIds)
      .where('status', '=', 'active')
      .groupBy('p_id')
      .execute()

    episodeCounts = Object.fromEntries(
      counts.map((c) => [String(c.p_id), Number(c.count)])
    )

    const sales = await db
      .selectFrom('ep_shop')
      .select(['p_id', ({ fn }) => fn.sum<string>('price').as('total')])
      .where('p_id', 'in', pIds)
      .groupBy('p_id')
      .execute()

    salesByWork = Object.fromEntries(
      sales.map((s) => [String(s.p_id), Number(s.total)])
    )
  }

  return rows.map((row) => ({
    uuid:              row.uuid,
    title:             row.title,
    cover_image:       row.cover_image,
    type:              row.type,
    age_rate:          row.age_rate ?? 'all',
    tags:              row.tags ?? [],
    publish_status:    row.publish_status,
    completion_status: row.completion_status,
    view_count:        String(row.view_count),
    episode_count:     episodeCounts[String(row.p_id)] ?? 0,
    sales:             salesByWork[String(row.p_id)] ?? 0,
    category_main: row.category_main_id
      ? { id: String(row.category_main_id), name: row.category_main_name }
      : null,
    category_sub: row.category_sub_id
      ? { id: String(row.category_sub_id), name: row.category_sub_name }
      : null,
    // "หมวดหมู่เสริม" = จำนวนแท็กอิสระของเรื่องนี้ (works.tags) นับจริงแทน hardcode 0 (มติ 2026-07-29)
    extra_category_count: (row.tags ?? []).length,
    created_at:        row.created_at,
    updated_at:        row.updated_at,
  }))
}

// ---- ดูข้อมูลผลงานเรื่องเดียว (สำหรับหน้าแก้ไขนิยาย) ----
export async function getWorkForEdit(userId: bigint, workUuid: string) {
  const row = await db
    .selectFrom('works as c')
    .leftJoin('categories as cm', 'cm.id', 'c.category_main')
    .leftJoin('categories as cs', 'cs.id', 'c.category_sub')
    .select([
      'c.uuid',
      'c.title',
      'c.original_title',
      'c.description',
      'c.synopsis',
      'c.cover_image',
      'c.type',
      'c.age_rate',
      'c.is_translated',
      'c.tags',
      'c.is_one_shot',
      'c.completion_status',
      'c.publish_status',
      'c.created_at',
      'c.updated_at',
      'cm.id as category_main_id',
      'cm.name as category_main_name',
      'cs.id as category_sub_id',
      'cs.name as category_sub_name',
    ])
    .where('c.uuid', '=', workUuid)
    .where('c.author_id', '=', userId)
    .where('c.status', '=', 'active')
    .executeTakeFirst()

  if (!row) throw new Error('WORK_NOT_FOUND')

  return {
    uuid:              row.uuid,
    title:             row.title,
    original_title:    row.original_title,
    description:       row.description,
    synopsis:          row.synopsis,
    cover_image:       row.cover_image,
    type:              row.type,
    age_rate:          row.age_rate ?? 'all',
    is_translated:     row.is_translated,
    tags:              row.tags,
    is_one_shot:       row.is_one_shot,
    completion_status: row.completion_status,
    publish_status:    row.publish_status,
    category_main: row.category_main_id
      ? { id: String(row.category_main_id), name: row.category_main_name }
      : null,
    category_sub: row.category_sub_id
      ? { id: String(row.category_sub_id), name: row.category_sub_name }
      : null,
    created_at:        row.created_at,
    updated_at:        row.updated_at,
  }
}

// ---- สร้างผลงานใหม่ ----
// ---- โควต้าสร้าง tag ใหม่ต่อเดือนต่อนักเขียน (2026-07-27 user ขอกันสร้าง tag ล้นๆ) ----
// นับเฉพาะ tag ที่ "ไม่เคยมีมาก่อนทั้งระบบ" (เช็คจากตาราง tags ตรงๆ ไม่ใช่แค่ของนักเขียนคนนี้)
// ไม่นับ tag ที่มีอยู่แล้ว (คนอื่นเคยสร้างไว้) ไม่ว่านักเขียนคนนี้จะเคยใช้มาก่อนหรือไม่ก็ตาม
const MONTHLY_NEW_TAG_QUOTA = 25

// ---- Sync work_tags (registry) ให้ตรงกับ tags array ที่กำลังจะ save ----
// เรียกจาก createWork/updateWork ทุกครั้งที่ tags เปลี่ยน ต้องอยู่ใน transaction เดียวกับ
// การเขียน works.tags เสมอ (กันข้อมูล 2 ที่ไม่ตรงกันถ้าอันใดอันหนึ่งพังกลางคัน)
async function syncWorkTags(
  trx: Transaction<DB>,
  pId: bigint,
  authorId: bigint,
  tagNames: string[],
) {
  const names = [...new Set(tagNames.map((t) => t.trim()).filter(Boolean))]

  if (names.length > 0) {
    // เช็คโควต้าก่อนเขียนอะไรทั้งนั้น — นับเฉพาะชื่อที่ไม่เคยมีในตาราง tags เลย (ใหม่จริง)
    const existing = await trx.selectFrom('tags').select('name').where('name', 'in', names).execute()
    const existingNames = new Set(existing.map((r) => r.name))
    const brandNewCount = names.filter((n) => !existingNames.has(n)).length

    if (brandNewCount > 0) {
      const usedThisMonth = await trx
        .selectFrom('tags')
        .select(({ fn }) => fn.countAll<string>().as('count'))
        .where('created_by', '=', authorId)
        .where('created_at', '>=', sql<Date>`date_trunc('month', now())`)
        .executeTakeFirstOrThrow()

      const remaining = MONTHLY_NEW_TAG_QUOTA - Number(usedThisMonth.count)
      if (brandNewCount > remaining) throw new Error('TAG_QUOTA_EXCEEDED')
    }
  }

  // upsert ทุกชื่อเข้า tags แล้วได้ id กลับมาครบทุกอัน (DO UPDATE SET เดิมซ้ำ เพื่อบังคับให้
  // RETURNING คืนค่าแม้แถวจะมีอยู่แล้วก็ตาม — DO NOTHING จะไม่ RETURNING แถวที่ชนกัน)
  const tagRows = names.length > 0
    ? await trx
        .insertInto('tags')
        .values(names.map((name) => ({ name, created_by: authorId })))
        .onConflict((oc) => oc.column('name').doUpdateSet((eb) => ({ name: eb.ref('excluded.name') })))
        .returning(['id', 'name'])
        .execute()
    : []

  // แทนที่ work_tags ทั้งหมดของงานนี้ให้ตรงกับ list ล่าสุดเสมอ — ง่ายกว่า diff add/remove ทีละอัน
  await trx.deleteFrom('work_tags').where('p_id', '=', pId).execute()

  if (tagRows.length > 0) {
    await trx
      .insertInto('work_tags')
      .values(tagRows.map((t) => ({ p_id: pId, tag_id: t.id, author_id: authorId })))
      .execute()
  }
}

export async function createWork(userId: bigint, data: CreateWorkInput) {
  const tags = data.tags ?? []

  return await db.transaction().execute(async (trx) => {
    const work = await trx
      .insertInto('works')
      .values({
        uuid:              uuidv7(),
        title:             data.title,
        original_title:    data.original_title ?? null,
        description:       data.description ?? null,
        type:              data.type,
        author_id:         userId,
        category_main:     data.category_main ? BigInt(data.category_main) : null,
        category_sub:      data.category_sub  ? BigInt(data.category_sub)  : null,
        origin_type:       data.origin_type   ?? null,
        age_rate:          data.age_rate       ?? null,
        is_translated:     data.is_translated  ?? false,
        tags:              tags,
        is_one_shot:       data.is_one_shot    ?? false,
        completion_status: data.completion_status ?? null,
        publish_status:    0,       // เริ่มต้นซ่อนเสมอ writer ต้องกด publish เอง
        status:            'active',
        created_by:        userId,
        updated_by:        userId,
      })
      .returning(['p_id', 'uuid', 'title', 'type', 'publish_status', 'created_at'])
      .executeTakeFirstOrThrow()

    await syncWorkTags(trx, work.p_id, userId, tags)

    const { p_id: _pId, ...result } = work
    return result
  })
}

// ---- แก้ข้อมูลผลงาน ----
export async function updateWork(
  userId: bigint,
  workUuid: string,
  data: UpdateWorkInput
) {
  // เช็ค ownership ก่อนเสมอ — writer แก้ได้เฉพาะงานตัวเองเท่านั้น
  const work = await db
    .selectFrom('works')
    .select('p_id')
    .where('uuid', '=', workUuid)
    .where('author_id', '=', userId)
    .where('status', '=', 'active')
    .executeTakeFirst()

  if (!work) throw new Error('WORK_NOT_FOUND')

  // Validate: ถ้าจะ publish ต้องมี cover image ก่อน
  if (data.publish_status === 1) {
    const current = await db
      .selectFrom('works')
      .select('cover_image')
      .where('p_id', '=', work.p_id)
      .executeTakeFirstOrThrow()

    if (!current.cover_image) throw new Error('COVER_REQUIRED')
  }

  // สร้าง object ที่จะ update — ใส่เฉพาะ field ที่ส่งมา
  const updates: Record<string, unknown> = {
    updated_at: new Date(),
    updated_by: userId,
  }

  if (data.title             !== undefined) updates.title             = data.title
  if (data.original_title    !== undefined) updates.original_title    = data.original_title
  if (data.description       !== undefined) updates.description       = data.description
  if (data.synopsis          !== undefined) updates.synopsis          = data.synopsis ? JSON.stringify(data.synopsis) : null
  if (data.category_main     !== undefined) updates.category_main     = data.category_main     ? BigInt(data.category_main)  : null
  if (data.category_sub      !== undefined) updates.category_sub      = data.category_sub      ? BigInt(data.category_sub)   : null
  if (data.origin_type       !== undefined) updates.origin_type       = data.origin_type
  if (data.age_rate          !== undefined) updates.age_rate          = data.age_rate
  if (data.is_translated     !== undefined) updates.is_translated     = data.is_translated
  if (data.tags              !== undefined) updates.tags              = data.tags
  if (data.is_one_shot       !== undefined) updates.is_one_shot       = data.is_one_shot
  if (data.completion_status !== undefined) updates.completion_status = data.completion_status
  if (data.publish_status    !== undefined) updates.publish_status    = data.publish_status

  return await db.transaction().execute(async (trx) => {
    const updated = await trx
      .updateTable('works')
      .set(updates)
      .where('p_id', '=', work.p_id)
      .returning(['uuid', 'title', 'publish_status', 'updated_at'])
      .executeTakeFirstOrThrow()

    if (data.tags !== undefined) {
      await syncWorkTags(trx, work.p_id, userId, data.tags)
    }

    return updated
  })
}

// ---- "นิยายแนะนำ" ในหน้าโปรไฟล์ (migration 021, 2026-07-29) ----
// นักเขียนปักหมุดผลงานตัวเองได้สูงสุด MAX_FEATURED_WORKS เรื่อง (เดา 8 ให้พอดีกับ ~4 การ์ด
// ต่อแถว x 2 แถวบนจอ desktop ทั่วไป ตามที่ user ขอ "จำกัดมากสุดแค่ 2 แถว")
const MAX_FEATURED_WORKS = 8

export async function setWorkFeatured(userId: bigint, workUuid: string, featured: boolean) {
  const work = await db
    .selectFrom('works')
    .select('p_id')
    .where('uuid', '=', workUuid)
    .where('author_id', '=', userId)
    .where('status', '=', 'active')
    .executeTakeFirst()

  if (!work) throw new Error('WORK_NOT_FOUND')

  if (featured) {
    const countRow = await db
      .selectFrom('works')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('author_id', '=', userId)
      .where('featured', '=', true)
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow()

    if (Number(countRow.count) >= MAX_FEATURED_WORKS) throw new Error('FEATURED_LIMIT')
  }

  await db
    .updateTable('works')
    .set({ featured })
    .where('p_id', '=', work.p_id)
    .execute()
}

// ---- ลบผลงาน (soft delete) ----
export async function deleteWork(userId: bigint, workUuid: string) {
  const work = await db
    .selectFrom('works')
    .select('p_id')
    .where('uuid', '=', workUuid)
    .where('author_id', '=', userId)
    .where('status', '=', 'active')
    .executeTakeFirst()

  if (!work) throw new Error('WORK_NOT_FOUND')

  // Soft delete — ห้ามลบจริง (เหมือน deleteEpisode() ด้านล่าง)
  await db
    .updateTable('works')
    .set({ status: 'deleted', deleted_at: new Date(), deleted_by: userId, updated_by: userId })
    .where('p_id', '=', work.p_id)
    .execute()
}

// ---- ดูสถิติผลงาน (สำหรับปุ่ม "สถิติ" ใน Dashboard) ----
export async function getWorkStats(userId: bigint, workUuid: string) {
  const work = await db
    .selectFrom('works')
    .select(['p_id', 'view_count'])
    .where('uuid', '=', workUuid)
    .where('author_id', '=', userId)
    .where('status', '=', 'active')
    .executeTakeFirst()

  if (!work) throw new Error('WORK_NOT_FOUND')

  const [likeRow, bookmarkRow, commentRow, episodeRow, salesRow] = await Promise.all([
    db.selectFrom('work_favorite').select(({ fn }) => fn.countAll<string>().as('count'))
      .where('p_id', '=', work.p_id).executeTakeFirst(),
    db.selectFrom('work_bookmarks').select(({ fn }) => fn.countAll<string>().as('count'))
      .where('p_id', '=', work.p_id).executeTakeFirst(),
    db.selectFrom('work_comments').select(({ fn }) => fn.countAll<string>().as('count'))
      .where('work_id', '=', work.p_id).where('parent_id', 'is', null).where('status', '=', 'active')
      .executeTakeFirst(),
    db.selectFrom('work_ep').select(({ fn }) => fn.countAll<string>().as('count'))
      .where('p_id', '=', work.p_id).where('status', '=', 'active').executeTakeFirst(),
    db.selectFrom('ep_shop').select(({ fn }) => fn.sum<string>('price').as('total'))
      .where('p_id', '=', work.p_id).executeTakeFirst(),
  ])

  return {
    view_count:    Number(work.view_count),
    like_count:    Number(likeRow?.count ?? 0),
    bookmark_count: Number(bookmarkRow?.count ?? 0),
    comment_count: Number(commentRow?.count ?? 0),
    episode_count: Number(episodeRow?.count ?? 0),
    sales:         Number(salesRow?.total ?? 0),
  }
}

// ---- Helper: เช็ค ownership แล้วคืน p_id — ใช้ร่วมกัน 3 ฟังก์ชันกราฟสถิติเจาะลึกด้านล่าง ----
async function assertOwnedWorkPId(userId: bigint, workUuid: string): Promise<bigint> {
  const work = await db
    .selectFrom('works')
    .select('p_id')
    .where('uuid', '=', workUuid)
    .where('author_id', '=', userId)
    .where('status', '=', 'active')
    .executeTakeFirst()
  if (!work) throw new Error('WORK_NOT_FOUND')
  return work.p_id
}

// ---- กราฟยอดวิวรายเดือน (รายวันภายในเดือนที่เลือก) — แท็บ "สถิติเจาะลึก" ----
// ⚠️ นับจาก work_ep_views ซึ่ง**บันทึกเฉพาะ user ที่ login เท่านั้น** (ดู getEpisodeContent ใน
// works.service.ts) — ยอดในกราฟนี้เลยอาจ "น้อยกว่า" ยอดวิวรวมจริงที่นับรวม guest ด้วย (works.view_count)
// ไม่ใช่บั๊ก แค่ข้อจำกัดของแหล่งข้อมูล — flag ไว้ใน KNOWN_ISSUES.md แล้ว รอ user ตัดสินใจว่าจะขยาย
// ให้ log guest (ผ่าน ip_address ที่มี column รออยู่แล้ว) ทีหลังไหม
export async function getWorkViewsMonthly(userId: bigint, workUuid: string, year: number, month: number) {
  const pId = await assertOwnedWorkPId(userId, workUuid)

  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const rows = await db
    .selectFrom('work_ep_views')
    .select([
      sql<number>`extract(day from created_at)::int`.as('day'),
      ({ fn }) => fn.countAll<string>().as('count'),
    ])
    .where('p_id', '=', pId)
    .where('created_at', '>=', start)
    .where('created_at', '<', end)
    .groupBy(sql`extract(day from created_at)`)
    .execute()

  const byDay = new Map(rows.map((r) => [r.day, Number(r.count)]))
  const daily = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, views: byDay.get(i + 1) ?? 0 }))
  const total = daily.reduce((sum, d) => sum + d.views, 0)

  return { daily, total }
}

// ---- กราฟยอดวิวรายปี (รายเดือนภายในปีที่เลือก) — แท็บ "สถิติเจาะลึก" ----
export async function getWorkViewsYearly(userId: bigint, workUuid: string, year: number) {
  const pId = await assertOwnedWorkPId(userId, workUuid)

  const start = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year + 1, 0, 1))

  const rows = await db
    .selectFrom('work_ep_views')
    .select([
      sql<number>`extract(month from created_at)::int`.as('month'),
      ({ fn }) => fn.countAll<string>().as('count'),
    ])
    .where('p_id', '=', pId)
    .where('created_at', '>=', start)
    .where('created_at', '<', end)
    .groupBy(sql`extract(month from created_at)`)
    .execute()

  const byMonth = new Map(rows.map((r) => [r.month, Number(r.count)]))
  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, views: byMonth.get(i + 1) ?? 0 }))
  const total = monthly.reduce((sum, m) => sum + m.views, 0)

  return { monthly, total }
}

// ---- 10 อันดับตอนที่มียอดวิวสูงสุด (นับจาก work_ep_views เหมือน 2 ฟังก์ชันบน) ----
export async function getWorkTopEpisodes(userId: bigint, workUuid: string, limit: number) {
  const pId = await assertOwnedWorkPId(userId, workUuid)

  const rows = await db
    .selectFrom('work_ep_views as v')
    .innerJoin('work_ep as e', (join) =>
      join.onRef('e.p_id', '=', 'v.p_id').onRef('e.ep_no', '=', 'v.ep_no'),
    )
    .select([
      'e.ep_id', 'e.ep_no', 'e.ep_name', 'e.episode_label',
      ({ fn }) => fn.countAll<string>().as('views'),
    ])
    .where('v.p_id', '=', pId)
    .where('e.status', '=', 'active')
    .groupBy(['e.ep_id', 'e.ep_no', 'e.ep_name', 'e.episode_label'])
    .orderBy('views', 'desc')
    .orderBy('e.ep_no', 'asc')
    .limit(limit)
    .execute()

  return rows.map((r) => ({
    ep_id:          String(r.ep_id),
    ep_no:          r.ep_no,
    ep_name:        r.ep_name,
    episode_label:  r.episode_label,
    views:          Number(r.views),
  }))
}

// ---- อัปโหลด cover image ----
export async function uploadCover(
  userId: bigint,
  workUuid: string,
  fileBuffer: Buffer,
  contentType: string,
  filename: string
) {
  // เช็ค ownership
  const work = await db
    .selectFrom('works')
    .select(['p_id', 'cover_image'])
    .where('uuid', '=', workUuid)
    .where('author_id', '=', userId)
    .where('status', '=', 'active')
    .executeTakeFirst()

  if (!work) throw new Error('WORK_NOT_FOUND')

  // เช็คว่าเป็นรูปภาพจริง ป้องกัน upload ไฟล์อันตราย
  if (!isAllowedImageType(contentType)) throw new Error('INVALID_FILE_TYPE')

  // resize + แปลง webp เสมอ (ดู lib/image.ts) — ผลคือ key จะลงท้าย .webp เสมอ
  // ไม่ว่าไฟล์ต้นฉบับจะเป็น jpg/png/webp ก็ตาม
  const processed = await processImage(fileBuffer, 'cover')
  const key = coverKey(workUuid, processed.ext)

  // Upload ขึ้น R2
  await uploadFile(key, processed.buffer, processed.contentType)

  // ถ้ามี cover เก่าจาก "ก่อนเพิ่ม webp" ค้างอยู่ (นามสกุลเก่าไม่ใช่ .webp) ให้ลบทิ้ง
  // ไม่งั้นจะกลายเป็นไฟล์ orphan ค้าง storage ตลอดไป (key ใหม่ต่างจากเดิม เลย overwrite เองไม่ได้)
  if (work.cover_image && !work.cover_image.endsWith('.webp')) {
    const oldExt = getExtension(work.cover_image)
    await deleteFile(coverKey(workUuid, oldExt)).catch(() => {})
  }

  const publicUrl = getPublicUrl(key)

  // บันทึก URL ลง DB
  await db
    .updateTable('works')
    .set({ cover_image: publicUrl, updated_at: new Date(), updated_by: userId })
    .where('p_id', '=', work.p_id)
    .execute()

  return { cover_image: publicUrl }
}

// =============================================================
// Episode Functions
// =============================================================

// ---- ดูรายการตอนของผลงานตัวเอง ----
export async function getMyEpisodes(userId: bigint, workUuid: string) {
  // เช็ค ownership ของผลงานก่อน
  const work = await db
    .selectFrom('works')
    .select('p_id')
    .where('uuid', '=', workUuid)
    .where('author_id', '=', userId)
    .where('status', '=', 'active')
    .executeTakeFirst()

  if (!work) throw new Error('WORK_NOT_FOUND')

  const episodes = await db
    .selectFrom('work_ep')
    .select([
      'ep_id',
      'ep_name',
      'ep_no',
      'ep_price',
      'publish_status',
      'schedule_datetime',
      'lock_duration_days',
      'total_image',
      'image_protection',
      'episode_label',
      'ep_content',
      'created_at',
      'updated_at',
    ])
    .where('p_id', '=', work.p_id)
    .where('status', '=', 'active')
    .orderBy('ep_no', 'asc')
    .execute()

  const ttsAccess = await db
    .selectFrom('tts_work_access')
    .select('tier')
    .where('p_id', '=', work.p_id)
    .executeTakeFirst()

  return episodes.map((ep) => ({
    ep_id:             String(ep.ep_id),
    ep_name:           ep.ep_name,
    ep_no:             ep.ep_no,
    ep_price:          ep.ep_price,
    is_free:           Number(ep.ep_price) === 0,
    publish_status:    ep.publish_status,
    schedule_datetime: ep.schedule_datetime,
    lock_duration_days: ep.lock_duration_days,
    total_image:       ep.total_image,
    image_protection:  ep.image_protection,
    episode_label:     ep.episode_label,
    // This is intentionally a capability tier, not a job control/status.
    // TTS requests and generation are managed exclusively by Admin.
    tts_tier:           ttsAccess?.tier ?? null,
    created_at:        ep.created_at,
    updated_at:        ep.updated_at,
  }))
}

// ---- ดูข้อมูลตอนเดียวแบบเต็ม (สำหรับหน้าแก้ไขตอน) ----
export async function getEpisodeForEdit(userId: bigint, epId: bigint) {
  const row = await db
    .selectFrom('work_ep as ep')
    .innerJoin('works as c', 'c.p_id', 'ep.p_id')
    .select([
      'ep.ep_id',
      'ep.ep_no',
      'ep.ep_name',
      'ep.ep_price',
      'ep.ep_content',
      'ep.publish_status',
      'ep.schedule_datetime',
      'ep.lock_duration_days',
      'ep.image_protection',
      'ep.reader_message',
      'ep.episode_label',
      'c.type',
    ])
    .where('ep.ep_id', '=', epId)
    .where('ep.status', '=', 'active')
    .where('c.author_id', '=', userId)
    .where('c.status', '=', 'active')
    .executeTakeFirst()

  if (!row) throw new Error('EPISODE_NOT_FOUND')

  return {
    ep_id:              String(row.ep_id),
    ep_no:              row.ep_no,
    ep_name:            row.ep_name,
    ep_price:           row.ep_price,
    ep_content:         row.ep_content,
    publish_status:     row.publish_status,
    schedule_datetime:  row.schedule_datetime,
    lock_duration_days: row.lock_duration_days,
    image_protection:   row.image_protection,
    reader_message:     row.reader_message,
    episode_label:      row.episode_label,
    type:               row.type,
  }
}

// ---- สร้างตอนใหม่ ----
export async function createEpisode(
  userId: bigint,
  workUuid: string,
  data: CreateEpisodeInput
) {
  // เช็ค ownership
  const work = await db
    .selectFrom('works')
    .select(['p_id', 'type', 'is_one_shot'])
    .where('uuid', '=', workUuid)
    .where('author_id', '=', userId)
    .where('status', '=', 'active')
    .executeTakeFirst()

  if (!work) throw new Error('WORK_NOT_FOUND')

  // Auto-assign ep_no = max ที่มีอยู่ + 1 (ค่าเริ่มต้น ถ้า writer ไม่ได้กำหนดเอง)
  // migration 014 — ดึง episode_label ของตอนล่าสุดมาด้วย เผื่อต้อง inherit ให้ตอนใหม่
  const lastEp = await db
    .selectFrom('work_ep')
    .select(['ep_no', 'episode_label'])
    .where('p_id', '=', work.p_id)
    .where('status', '=', 'active')
    .orderBy('ep_no', 'desc')
    .limit(1)
    .executeTakeFirst()

  // one-shot = มีได้แค่ตอนเดียวตลอดไป บล็อกตั้งแต่จะสร้างตอนที่ 2 เลย
  // (ไม่รอให้ publish ก่อน — ตาม decision ของ user)
  if (work.is_one_shot && lastEp) throw new Error('ONE_SHOT_LIMIT')

  let nextEpNo = (lastEp?.ep_no ?? 0) + 1

  // migration 010 — writer กำหนดเลขลำดับตอนเองได้ (เริ่มจาก 0 ได้ ห้ามซ้ำกับตอนที่ยังไม่ลบ)
  if (data.ep_no !== undefined) {
    if (data.ep_no < 0) throw new Error('INVALID_EP_NO')
    const conflict = await db
      .selectFrom('work_ep')
      .select('ep_id')
      .where('p_id', '=', work.p_id)
      .where('ep_no', '=', data.ep_no)
      .where('status', '=', 'active')
      .executeTakeFirst()
    if (conflict) throw new Error('EP_NO_TAKEN')
    nextEpNo = data.ep_no
  }

  // novel: ep_content จาก input หรือ null (เพิ่มทีหลังผ่าน PATCH ได้)
  // manga: ep_content เป็น null เสมอ (ใช้ work_ep_image แทน)
  // ต้อง JSON.stringify ก่อน insert ลงคอลัมน์ JSONB เอง — Kysely/pg ไม่ serialize
  // array/object ให้อัตโนมัติ (แบบเดียวกับที่ updateWork() ทำกับ synopsis)
  const epContent: NovelBlock[] | null = work.type === 'novel' && data.ep_content
    ? JSON.stringify(data.ep_content) as unknown as NovelBlock[]
    : null

  // migration 014 — ถ้าไม่ได้ระบุคำเรียกตอนมาเอง (undefined) inherit จากตอนล่าสุดของเรื่องนี้
  // (ถ้ายังไม่มีตอนเลยก็เป็น null) ระบุ null ตรงๆ มา = ตั้งใจไม่มีคำเรียก ไม่ inherit
  const episodeLabel = data.episode_label !== undefined
    ? data.episode_label
    : (lastEp?.episode_label ?? null)

  const episode = await db
    .insertInto('work_ep')
    .values({
      p_id:              work.p_id,
      ep_name:           data.ep_name,
      ep_no:             nextEpNo,
      ep_price:          data.ep_price ?? '0',
      ep_content:        epContent,
      total_image:       0,
      image_protection:  data.image_protection ?? false,
      reader_message:    data.reader_message ?? null,
      episode_label:     episodeLabel,
      publish_status:    data.publish_status ?? 'hide',  // เริ่มต้นซ่อนเสมอ
      schedule_datetime: data.schedule_datetime ?? null,
      lock_duration_days: data.lock_duration_days ?? null,
      status:            'active',
      created_by:        userId,
      updated_by:        userId,
    })
    .returning(['ep_id', 'ep_name', 'ep_no', 'ep_price', 'publish_status', 'episode_label', 'created_at'])
    .executeTakeFirstOrThrow()

  if (episode.publish_status === 'now' || episode.publish_status === 'schedule') {
    await enqueueAutoTtsForEpisode(episode.ep_id)
  }

  return { ...episode, ep_id: String(episode.ep_id) }
}

// ---- แก้ข้อมูลตอน ----
export async function updateEpisode(
  userId: bigint,
  epId: bigint,
  data: UpdateEpisodeInput
) {
  // หาตอนและเช็ค ownership ผ่าน works.author_id
  const episode = await db
    .selectFrom('work_ep as ep')
    .innerJoin('works as c', 'c.p_id', 'ep.p_id')
    .select(['ep.ep_id', 'ep.p_id', 'ep.ep_no', 'ep.total_image', 'ep.publish_status', 'ep.ep_content', 'c.type'])
    .where('ep.ep_id', '=', epId)
    .where('ep.status', '=', 'active')
    .where('c.author_id', '=', userId)
    .where('c.status', '=', 'active')
    .executeTakeFirst()

  if (!episode) throw new Error('EPISODE_NOT_FOUND')

  // migration 010 — writer แก้เลขลำดับตอนเองได้ (เริ่มจาก 0 ได้ ห้ามซ้ำกับตอนอื่นที่ยังไม่ลบ)
  if (data.ep_no !== undefined && data.ep_no !== episode.ep_no) {
    if (data.ep_no < 0) throw new Error('INVALID_EP_NO')
    const conflict = await db
      .selectFrom('work_ep')
      .select('ep_id')
      .where('p_id', '=', episode.p_id)
      .where('ep_no', '=', data.ep_no)
      .where('ep_id', '!=', epId)
      .where('status', '=', 'active')
      .executeTakeFirst()
    if (conflict) throw new Error('EP_NO_TAKEN')
  }

  // Validate: ถ้าจะ publish ต้องมี content จริง
  if (data.publish_status === 'now' || data.publish_status === 'schedule') {
    if (episode.type === 'manga' && episode.total_image === 0) {
      throw new Error('NO_IMAGES')   // manga ต้องมีรูปก่อน publish
    }
    if (episode.type === 'novel') {
      const currentContent = data.ep_content
      if (!currentContent || currentContent.length === 0) {
        // ดึง content ปัจจุบันมาเช็ค ถ้า data ไม่ได้ส่ง ep_content มาใหม่
        const current = await db
          .selectFrom('work_ep')
          .select('ep_content')
          .where('ep_id', '=', epId)
          .executeTakeFirstOrThrow()
        if (!current.ep_content || current.ep_content.length === 0) {
          throw new Error('NO_CONTENT')  // novel ต้องมี blocks ก่อน publish
        }
      }
    }
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date(),
    updated_by: userId,
  }

  if (data.ep_name           !== undefined) updates.ep_name           = data.ep_name
  if (data.ep_no             !== undefined) updates.ep_no             = data.ep_no
  if (data.ep_price          !== undefined) updates.ep_price          = data.ep_price
  if (data.publish_status    !== undefined) updates.publish_status    = data.publish_status
  if (data.schedule_datetime !== undefined) updates.schedule_datetime = data.schedule_datetime
  if (data.lock_duration_days !== undefined) updates.lock_duration_days = data.lock_duration_days
  if (data.image_protection  !== undefined) updates.image_protection  = data.image_protection
  if (data.reader_message    !== undefined) updates.reader_message    = data.reader_message
  // migration 014 — แก้คำเรียกของตอนนี้ตอนเดียวตรงๆ ไม่ sync ไปตอนอื่น (ใช้ bulkUpdateEpisodeLabel()
  // แทนถ้าต้องการแก้หลายตอนพร้อมกัน)
  if (data.episode_label     !== undefined) updates.episode_label    = data.episode_label
  // ep_content อัปเดตได้เฉพาะ novel — ถ้าส่งมาก็ update ได้เลย
  // ต้อง JSON.stringify ก่อน insert ลงคอลัมน์ JSONB เอง (ดู createEpisode() ด้านบน)
  let ttsSourceChanged = false
  if (data.ep_content !== undefined) {
    const previousBlocks = episode.ep_content ?? []
    const nextBlocks = data.ep_content ?? []
    ttsSourceChanged = getTtsSourceHash(previousBlocks) !== getTtsSourceHash(nextBlocks)
    // Reset timecodes only when what VoxCPM will speak has changed. A normal
    // metadata/no-op save must not hide already-completed reader audio.
    updates.ep_content = data.ep_content
      ? JSON.stringify(ttsSourceChanged ? clearAudioTimestamps(data.ep_content) : preserveAudioTimestamps(previousBlocks, data.ep_content))
      : null
  }

  const updated = await db
    .updateTable('work_ep')
    .set(updates)
    .where('ep_id', '=', epId)
    .returning(['ep_id', 'ep_name', 'ep_no', 'ep_price', 'publish_status', 'episode_label', 'updated_at'])
    .executeTakeFirstOrThrow()

  if (data.ep_content !== undefined && ttsSourceChanged) await invalidateTtsForEpisode(epId)

  // Once a work has an approved TTS capability, a newly published episode
  // enters the system-update queue automatically. It never bypasses the
  // Admin queue for the work's original request.
  const becomesPublished = data.publish_status === 'now' || data.publish_status === 'schedule'
  const wasPublished = episode.publish_status === 'now' || episode.publish_status === 'schedule'
  if (becomesPublished && (!wasPublished || data.ep_content !== undefined)) {
    await enqueueAutoTtsForEpisode(epId)
  }

  return { ...updated, ep_id: String(updated.ep_id) }
}

// ---- แก้คำเรียกตอนหลายตอนพร้อมกัน (ปุ่มฟันเฟือง "ตั้งค่าพิเศษ") ----
// เลือกตอนได้ 2 แบบ: (1) ช่วงเลขตอน start-end (กำหนดช่วงกว้างครอบตอนล่าสุด = เหมือนตั้ง
// default ตั้งแต่นี้ไป, กำหนดช่วงแคบ = แก้เฉพาะบางช่วง) หรือ (2) ระบุ epIds ตรงๆ (sync กับ
// checkbox ที่ตารางเลือกไว้ — ใช้เลือกตอนแบบไม่ต่อเนื่องกันได้ด้วย) — ส่ง epIds มา ใช้แบบนั้นก่อนเสมอ
export async function bulkUpdateEpisodeLabel(
  userId: bigint,
  workUuid: string,
  target: { startEpNo?: number; endEpNo?: number; epIds?: bigint[] },
  label: string | null
) {
  const work = await db
    .selectFrom('works')
    .select('p_id')
    .where('uuid', '=', workUuid)
    .where('author_id', '=', userId)
    .where('status', '=', 'active')
    .executeTakeFirst()

  if (!work) throw new Error('WORK_NOT_FOUND')

  let query = db
    .updateTable('work_ep')
    .set({ episode_label: label, updated_at: new Date(), updated_by: userId })
    .where('p_id', '=', work.p_id)
    .where('status', '=', 'active')

  if (target.epIds && target.epIds.length > 0) {
    query = query.where('ep_id', 'in', target.epIds)
  } else if (target.startEpNo !== undefined && target.endEpNo !== undefined) {
    if (target.startEpNo < 0 || target.endEpNo < target.startEpNo) throw new Error('INVALID_EP_NO_RANGE')
    query = query.where('ep_no', '>=', target.startEpNo).where('ep_no', '<=', target.endEpNo)
  } else {
    throw new Error('INVALID_EP_NO_RANGE')
  }

  const result = await query.executeTakeFirst()

  return { updated_count: Number(result.numUpdatedRows) }
}

// ---- ตั้งเวลาเผยแพร่ / เผยแพร่ทันที หลายตอนพร้อมกัน (ปุ่มนาฬิกา) ----
// เลือกตอนแบบเดียวกับ bulkUpdateEpisodeLabel() (ช่วง ep_no หรือ epIds ตรงๆ)
// ข้ามตอนที่ยังไม่มีเนื้อหา/รูปให้อัตโนมัติ (กันเผยแพร่ตอนเปล่าๆ โดยไม่ตั้งใจ — เหมือน validation
// เดียวกับ updateEpisode() ตอนเดียว) แล้วรายงานว่าทำสำเร็จกี่ตอน ข้ามไปกี่ตอน
export async function bulkUpdateEpisodePublish(
  userId: bigint,
  workUuid: string,
  target: { startEpNo?: number; endEpNo?: number; epIds?: bigint[] },
  publishStatus: 'now' | 'schedule',
  scheduleDatetime?: Date
) {
  const work = await db
    .selectFrom('works')
    .select(['p_id', 'type'])
    .where('uuid', '=', workUuid)
    .where('author_id', '=', userId)
    .where('status', '=', 'active')
    .executeTakeFirst()

  if (!work) throw new Error('WORK_NOT_FOUND')
  if (publishStatus === 'schedule' && !scheduleDatetime) throw new Error('SCHEDULE_DATETIME_REQUIRED')

  let selectQuery = db
    .selectFrom('work_ep')
    .select(['ep_id', 'ep_content', 'total_image'])
    .where('p_id', '=', work.p_id)
    .where('status', '=', 'active')

  if (target.epIds && target.epIds.length > 0) {
    selectQuery = selectQuery.where('ep_id', 'in', target.epIds)
  } else if (target.startEpNo !== undefined && target.endEpNo !== undefined) {
    if (target.startEpNo < 0 || target.endEpNo < target.startEpNo) throw new Error('INVALID_EP_NO_RANGE')
    selectQuery = selectQuery.where('ep_no', '>=', target.startEpNo).where('ep_no', '<=', target.endEpNo)
  } else {
    throw new Error('INVALID_EP_NO_RANGE')
  }

  const candidates = await selectQuery.execute()

  const readyIds = candidates
    .filter((ep) => (work.type === 'manga' ? ep.total_image > 0 : ep.ep_content && ep.ep_content.length > 0))
    .map((ep) => ep.ep_id)

  const skippedCount = candidates.length - readyIds.length

  if (readyIds.length === 0) {
    return { updated_count: 0, skipped_count: skippedCount }
  }

  await db
    .updateTable('work_ep')
    .set({
      publish_status: publishStatus,
      schedule_datetime: publishStatus === 'schedule' ? scheduleDatetime! : null,
      updated_at: new Date(),
      updated_by: userId,
    })
    .where('ep_id', 'in', readyIds)
    .execute()

  return { updated_count: readyIds.length, skipped_count: skippedCount }
}

// ---- ตั้งราคาหลายตอนพร้อมกัน (ปุ่มเหรียญ) ----
// ตั้งใจให้ง่ายกว่า bulkUpdateEpisodeLabel()/bulkUpdateEpisodePublish() — เลือกได้แค่จาก
// checkbox ที่ตารางเลือกไว้เท่านั้น ไม่มีโหมดช่วงเลขตอน (ตาม user ขอ) ราคา "0" = ฟรี
export async function bulkUpdateEpisodePrice(
  userId: bigint,
  workUuid: string,
  epIds: bigint[],
  price: string
) {
  const work = await db
    .selectFrom('works')
    .select('p_id')
    .where('uuid', '=', workUuid)
    .where('author_id', '=', userId)
    .where('status', '=', 'active')
    .executeTakeFirst()

  if (!work) throw new Error('WORK_NOT_FOUND')
  if (epIds.length === 0) throw new Error('NO_EPISODES_SELECTED')

  const result = await db
    .updateTable('work_ep')
    .set({ ep_price: price, updated_at: new Date(), updated_by: userId })
    .where('p_id', '=', work.p_id)
    .where('status', '=', 'active')
    .where('ep_id', 'in', epIds)
    .executeTakeFirst()

  return { updated_count: Number(result.numUpdatedRows) }
}

// ---- ลบตอน (soft delete) ----
export async function deleteEpisode(userId: bigint, epId: bigint) {
  // เช็ค ownership
  const episode = await db
    .selectFrom('work_ep as ep')
    .innerJoin('works as c', 'c.p_id', 'ep.p_id')
    .select('ep.ep_id')
    .where('ep.ep_id', '=', epId)
    .where('ep.status', '=', 'active')
    .where('c.author_id', '=', userId)
    .where('c.status', '=', 'active')
    .executeTakeFirst()

  if (!episode) throw new Error('EPISODE_NOT_FOUND')

  // Soft delete — ห้ามลบจริง
  await db
    .updateTable('work_ep')
    .set({ status: 'deleted', updated_at: new Date(), updated_by: userId })
    .where('ep_id', '=', epId)
    .execute()
}

// =============================================================
// Image Upload Functions (Manga เท่านั้น)
// =============================================================

// ---- อัปโหลดภาพ manga ----
// files = array ของ { buffer, contentType, filename }
// เรียงตาม index ที่ส่งมา → sort_order ต่อจาก max ที่มีอยู่
export async function uploadEpisodeImages(
  userId: bigint,
  epId: bigint,
  files: { buffer: Buffer; contentType: string; filename: string }[]
) {
  // หาตอนและเช็ค ownership + เช็คว่าเป็น manga
  const episode = await db
    .selectFrom('work_ep as ep')
    .innerJoin('works as c', 'c.p_id', 'ep.p_id')
    .select(['ep.ep_id', 'ep.p_id', 'ep.ep_no', 'ep.total_image', 'c.type'])
    .where('ep.ep_id', '=', epId)
    .where('ep.status', '=', 'active')
    .where('c.author_id', '=', userId)
    .where('c.status', '=', 'active')
    .executeTakeFirst()

  if (!episode) throw new Error('EPISODE_NOT_FOUND')
  if (episode.type !== 'manga') throw new Error('NOT_MANGA')  // novel ไม่มีภาพ

  // เช็คทุกไฟล์ว่าเป็นรูปภาพ
  for (const f of files) {
    if (!isAllowedImageType(f.contentType)) throw new Error('INVALID_FILE_TYPE')
  }

  // หา sort_order ปัจจุบันสูงสุด เพื่อต่อจากตรงนั้น
  const maxOrderRow = await db
    .selectFrom('work_ep_image')
    .select(({ fn }) => fn.max('sort_order').as('max_order'))
    .where('ep_id', '=', epId)
    .executeTakeFirst()

  const startOrder = (maxOrderRow?.max_order ?? -1) + 1

  // Upload ทุกไฟล์และ insert DB
  // resize + แปลง webp เสมอ (ดู lib/image.ts) — ใช้ preset 'mangaPage' คุณภาพสูงกว่ารูปตกแต่งทั่วไป
  // เพราะเป็นเนื้อหาที่ user จ่ายเงินอ่านจริง
  const inserted = await Promise.all(
    files.map(async (f, index) => {
      const sortOrder = startOrder + index
      const processed = await processImage(f.buffer, 'mangaPage')
      const key        = episodeImageKey(String(episode.p_id), episode.ep_no, sortOrder, processed.ext)

      await uploadFile(key, processed.buffer, processed.contentType)

      const row = await db
        .insertInto('work_ep_image')
        .values({
          ep_id:      epId,
          p_id:       episode.p_id,
          ep_no:      episode.ep_no,
          image_path: getPublicUrl(key),
          sort_order: sortOrder,
        })
        .returning(['id', 'image_path', 'sort_order'])
        .executeTakeFirstOrThrow()

      return { ...row, id: String(row.id) }
    })
  )

  // อัปเดต total_image ใน manga_ep
  await db
    .updateTable('work_ep')
    .set({
      total_image: sql<number>`total_image + ${files.length}`,
      updated_at:  new Date(),
    })
    .where('ep_id', '=', epId)
    .execute()

  return inserted
}

// ---- ลบภาพ manga ----
export async function deleteImage(userId: bigint, imageId: bigint) {
  // หาภาพและเช็ค ownership
  const image = await db
    .selectFrom('work_ep_image as img')
    .innerJoin('work_ep as ep', 'ep.ep_id', 'img.ep_id')
    .innerJoin('works as c', 'c.p_id', 'ep.p_id')
    .select(['img.id', 'img.image_path', 'img.ep_id'])
    .where('img.id', '=', imageId)
    .where('ep.status', '=', 'active')
    .where('c.author_id', '=', userId)
    .where('c.status', '=', 'active')
    .executeTakeFirst()

  if (!image) throw new Error('IMAGE_NOT_FOUND')

  // ลบจาก DB และลด total_image พร้อมกัน (transaction)
  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom('work_ep_image')
      .where('id', '=', imageId)
      .execute()

    await trx
      .updateTable('work_ep')
      .set({ total_image: sql<number>`total_image - 1`, updated_at: new Date() })
      .where('ep_id', '=', image.ep_id)
      .execute()
  })

  // ลบจาก R2 หลัง DB สำเร็จ
  // ⚠️ ถ้า R2 ลบ fail ไฟล์จะ orphan อยู่ใน R2 → TODO: cleanup job ทีหลัง
  //
  // 2026-08-11 บั๊กจริงที่เจอ: image_path เก็บ URL เต็ม (getPublicUrl(key) ตอน insert) แต่ตรงนี้ส่ง
  // image_path เข้า deleteFile() ตรงๆ โดยไม่แปลงกลับเป็น key ก่อน (deleteFile ต้องการแค่ key เช่น
  // "manga/123/1/0.jpg" ไม่ใช่ URL เต็ม) — R2 หา object ด้วย key ที่ผิดไม่เจอ ลบไม่ออกจริง ไฟล์
  // ภาพทุกใบที่เคย "ลบ" ผ่านฟังก์ชันนี้เลย orphan ค้างจริงบน R2 มาตลอด แก้โดยแปลงผ่าน
  // getKeyFromUrl() ก่อนเหมือน pattern ที่ admin.service.ts (carousels) ใช้ถูกอยู่แล้ว
  await deleteFile(getKeyFromUrl(image.image_path)).catch((err) => {
    console.error(`[deleteImage] failed to delete R2 object for image ${imageId}:`, err)
  })
}

// =============================================================
// Novel Auto-Chunker
// =============================================================

// ---- หั่นข้อความนิยายเป็น blocks อัตโนมัติ ----
// ใช้สำหรับ writer ที่อยากวางข้อความทั้งก้อนแล้วให้ระบบจัดการให้
//
// ตัดด้วย:
//   - บรรทัดว่าง (ย่อหน้าใหม่)
// จัดประเภท label:
//   - ขึ้นต้นด้วย " หรือ " → dialogue
//   - อื่นๆ               → paragraph

export function autoChunkText(rawText: string): NovelBlock[] {
  const lines = rawText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  return lines.map((line, index) => {
    // Thai quote marks: “ = " (left), ” = " (right)
    // รับทั้ง Thai style และ straight quote "
    const isDialogue =
      line.startsWith('“') ||  // "
      line.startsWith('”') ||  // "
      line.startsWith('"')          // straight quote

    return {
      id:       `block_${index + 1}`,
      display_label: isDialogue ? 'dialogue' : 'paragraph',
      text:     line,
      style:    null,
      audio_ts: null,
    }
  })
}

// =============================================================
// Withdrawal Functions (migration 031 — เปลี่ยนโมเดลทั้งหมด)
// =============================================================
//
// เดิมระบบนี้ขอถอนยอด sales ทั้งหมดในครั้งเดียว ไม่มีบัญชีธนาคารผูกไว้เลย — user ขอเปลี่ยนใหม่ทั้งชุด
// (2026-08-06, อ้างอิงหน้า "คำขอถอนเงิน" ของ ReadToon Creator ที่ user ส่งมา):
//   - พิมพ์จำนวนเงินขอถอนเอง (500-50,000 บาท/ครั้ง, ไม่เกินยอดเงินคงเหลือ)
//   - ต้องมีบัญชีธนาคารที่ยืนยันแล้วก่อน (users.bank_code/bank_account_name/bank_account_number)
//   - ถอนฟรี 2 ครั้ง/เดือน เกินจากนั้นมีค่าธรรมเนียมคงที่ 20 บาท/ครั้ง
//   - ตัดระบบถอนเป็นคอยน์ทิ้งทั้งหมด (โอนเข้าบัญชีธนาคารอย่างเดียว)

export const WITHDRAWAL_MIN_AMOUNT = 500
export const WITHDRAWAL_MAX_AMOUNT = 50000
export const WITHDRAWAL_FREE_PER_MONTH = 2
export const WITHDRAWAL_FEE_AMOUNT = 20

// ---- ขอถอนเงิน ----
export async function requestWithdrawal(userId: bigint, amount: number) {
  if (amount < WITHDRAWAL_MIN_AMOUNT || amount > WITHDRAWAL_MAX_AMOUNT) {
    throw new Error('AMOUNT_OUT_OF_RANGE')
  }

  const user = await db
    .selectFrom('users')
    .select(['sales', 'withdrawal_rate', 'bank_code', 'bank_account_name', 'bank_account_number'])
    .where('id', '=', userId)
    .executeTakeFirstOrThrow()

  if (!user.bank_code || !user.bank_account_name || !user.bank_account_number) {
    throw new Error('NO_BANK_ACCOUNT')
  }

  // มีการแก้ไขข้อมูลนักเขียน (user_detail, migration 056) ที่ยังรอแอดมินตรวจสอบอยู่ — บล็อกถอนเงิน
  // ไว้ก่อนจนกว่าจะได้รับการยืนยัน (user ขอ — กันเคสแก้ข้อมูลติดต่อ/ตัวตนแล้วรีบถอนเงินก่อนแอดมินทัน
  // ตรวจสอบ) ไม่เกี่ยวกับ bank_change_requests ด้านบน (คนละระบบ คนละ table กันอยู่แล้ว)
  const pendingInfoEdit = await db
    .selectFrom('user_detail')
    .select('id')
    .where('user_id', '=', userId)
    .where('status', '=', 'pending')
    .executeTakeFirst()

  if (pendingInfoEdit) throw new Error('PENDING_INFO_EDIT')

  // WITHDRAWAL_RATE คือสัดส่วนที่ writer ได้รับจากยอดขาย (0.7 = 70%) — ใช้ค่า override เฉพาะ
  // user นี้ก่อนเสมอ (users.withdrawal_rate) ถ้าไม่มีค่อย fallback ไปค่ากลางจาก .env — สูตร
  // เดียวกับ getWriterDashboard()/getWriterOverviewStats() เป๊ะ
  const rate = user.withdrawal_rate !== null ? Number(user.withdrawal_rate) : Number(process.env.WITHDRAWAL_RATE ?? '0.7')
  const availableBalance = Math.floor(Number(user.sales) * rate * 100) / 100

  if (amount > availableBalance) throw new Error('INSUFFICIENT_BALANCE')

  // ถ้ามี pending withdrawal ค้างอยู่ → รอ admin approve/reject ก่อนถึงจะขอใหม่ได้
  const pending = await db
    .selectFrom('withdrawals')
    .select('id')
    .where('user_id', '=', userId)
    .where('status', '=', 'pending')
    .executeTakeFirst()

  if (pending) throw new Error('PENDING_WITHDRAWAL_EXISTS')

  // นับจำนวนครั้งที่ "ส่งคำขอ" ถอนไปแล้วในเดือนนี้ (ทุกสถานะ — ต้นทุนดำเนินการเกิดตั้งแต่ส่งคำขอ
  // ไม่ว่าผลจะออกมาอนุมัติหรือปฏิเสธ) เกินสิทธิ์ฟรีแล้วเก็บค่าธรรมเนียมคงที่
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
  const countThisMonthRow = await db
    .selectFrom('withdrawals')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('user_id', '=', userId)
    .where('created_at', '>=', monthStart)
    .executeTakeFirstOrThrow()

  const usedThisMonth = Number(countThisMonthRow.total)
  const feeAmount = usedThisMonth >= WITHDRAWAL_FREE_PER_MONTH ? WITHDRAWAL_FEE_AMOUNT : 0
  const netAmount = Math.max(amount - feeAmount, 0)

  // snapshot บัญชีธนาคาร ณ ตอนขอถอน — กันประวัติเก่าโชว์ผิดถ้า user เปลี่ยนบัญชีทีหลัง
  const withdrawal = await db
    .insertInto('withdrawals')
    .values({
      user_id:        userId,
      amount:         String(amount),      // Decimal column — ต้องเป็น string เสมอ (กัน float precision loss)
      fee_amount:     String(feeAmount),
      net_amount:     String(netAmount),
      bank_code:      user.bank_code,
      account_name:   user.bank_account_name,
      account_number: user.bank_account_number,
      status:         'pending',
    })
    .returning(['id', 'amount', 'fee_amount', 'net_amount', 'bank_code', 'account_name', 'account_number', 'status', 'created_at'])
    .executeTakeFirstOrThrow()

  return {
    id:             String(withdrawal.id),
    amount:         withdrawal.amount,
    fee_amount:     withdrawal.fee_amount,
    net_amount:     withdrawal.net_amount,
    bank_code:      withdrawal.bank_code,
    account_name:   withdrawal.account_name,
    account_number: withdrawal.account_number,
    status:         withdrawal.status,
    created_at:     withdrawal.created_at,
  }
}

// ---- ประวัติการถอนเงิน ----
export async function getWithdrawalHistory(
  userId: bigint,
  page: number,
  limit: number,
  status?: 'pending' | 'approved' | 'rejected'
) {
  const offset = (page - 1) * limit

  let baseQuery = db.selectFrom('withdrawals').where('user_id', '=', userId)
  if (status) baseQuery = baseQuery.where('status', '=', status)

  const rows = await baseQuery
    .select([
      'id',
      'amount',
      'fee_amount',
      'net_amount',
      'bank_code',
      'account_name',
      'account_number',
      'status',
      'reason',
      'approved_at',
      'created_at',
      'updated_at',
    ])
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  const countRow = await baseQuery
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .executeTakeFirstOrThrow()

  const total = Number(countRow.total)

  return {
    data: rows.map((r) => ({
      id:             String(r.id),
      amount:         r.amount,
      fee_amount:     r.fee_amount,
      net_amount:     r.net_amount,
      bank_code:      r.bank_code,
      account_name:   r.account_name,
      account_number: r.account_number,
      status:         r.status,
      reason:         r.reason,      // เหตุผล reject (ถ้ามี)
      approved_at:    r.approved_at,
      created_at:     r.created_at,
      updated_at:     r.updated_at,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  }
}

// ---- สรุปยอดสำหรับหน้า "ถอนเงิน" (3 การ์ดบนสุด) ----
export async function getWithdrawOverview(userId: bigint) {
  const user = await db
    .selectFrom('users')
    .select(['sales', 'withdrawal_rate'])
    .where('id', '=', userId)
    .executeTakeFirstOrThrow()

  const rate = user.withdrawal_rate !== null ? Number(user.withdrawal_rate) : Number(process.env.WITHDRAWAL_RATE ?? '0.7')
  const availableBalance = Math.floor(Number(user.sales) * rate * 100) / 100

  const pendingRow = await db
    .selectFrom('withdrawals')
    .select(({ fn }) => [
      fn.countAll<string>().as('count'),
      fn.coalesce(fn.sum<string>('net_amount'), sql<string>`0`).as('total'),
    ])
    .where('user_id', '=', userId)
    .where('status', '=', 'pending')
    .executeTakeFirstOrThrow()

  const totalWithdrawnRow = await db
    .selectFrom('withdrawals')
    .select(({ fn }) => fn.coalesce(fn.sum<string>('net_amount'), sql<string>`0`).as('total'))
    .where('user_id', '=', userId)
    .where('status', '=', 'approved')
    .executeTakeFirstOrThrow()

  // จำนวนครั้งที่ขอถอนไปแล้วในเดือนนี้ — ใช้พรีวิวค่าธรรมเนียมฝั่ง client ก่อนกดยืนยันจริง
  // (สูตรเดียวกับ requestWithdrawal() เป๊ะ — WITHDRAWAL_FREE_PER_MONTH ครั้งแรกฟรี)
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
  const usedThisMonthRow = await db
    .selectFrom('withdrawals')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('user_id', '=', userId)
    .where('created_at', '>=', monthStart)
    .executeTakeFirstOrThrow()

  return {
    available_balance: availableBalance,
    pending_amount:     Number(pendingRow.total),
    pending_count:       Number(pendingRow.count),
    total_withdrawn:     Number(totalWithdrawnRow.total),
    used_this_month:     Number(usedThisMonthRow.total),
  }
}

// =============================================================
// Bank Account Functions (migration 031)
// =============================================================

const BANK_CHANGE_LIMIT_PER_30_DAYS = 2

// ---- ข้อมูลบัญชีธนาคารปัจจุบัน + โควตาการขอเปลี่ยน ----
export async function getMyBankInfo(userId: bigint) {
  const user = await db
    .selectFrom('users')
    .select(['bank_code', 'bank_account_name', 'bank_account_number'])
    .where('id', '=', userId)
    .executeTakeFirstOrThrow()

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const changesRow = await db
    .selectFrom('bank_change_requests')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('user_id', '=', userId)
    .where('created_at', '>=', since)
    .executeTakeFirstOrThrow()

  const pending = await db
    .selectFrom('bank_change_requests')
    .select(['id', 'created_at'])
    .where('user_id', '=', userId)
    .where('status', '=', 'pending')
    .executeTakeFirst()

  return {
    bank_code:                  user.bank_code,
    account_name:               user.bank_account_name,
    account_number:             user.bank_account_number,
    changes_used_last_30_days:  Number(changesRow.total),
    changes_limit:              BANK_CHANGE_LIMIT_PER_30_DAYS,
    has_pending_request:        Boolean(pending),
  }
}

export interface BankChangeInput {
  bank_code:      string
  account_name:   string
  account_number: string
  reason?:        string
}

// ---- ส่งคำขอตั้ง/เปลี่ยนบัญชีธนาคาร (แนบหลักฐาน รอแอดมินอนุมัติ) ----
export async function requestBankChange(
  userId: bigint,
  userUuid: string,
  input: BankChangeInput,
  file: { buffer: Buffer; contentType: string }
) {
  if (!isValidBankCode(input.bank_code)) throw new Error('INVALID_BANK_CODE')

  const pending = await db
    .selectFrom('bank_change_requests')
    .select('id')
    .where('user_id', '=', userId)
    .where('status', '=', 'pending')
    .executeTakeFirst()

  if (pending) throw new Error('PENDING_BANK_CHANGE_EXISTS')

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const countRow = await db
    .selectFrom('bank_change_requests')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('user_id', '=', userId)
    .where('created_at', '>=', since)
    .executeTakeFirstOrThrow()

  if (Number(countRow.total) >= BANK_CHANGE_LIMIT_PER_30_DAYS) throw new Error('BANK_CHANGE_QUOTA_EXCEEDED')

  const processed = await processImage(file.buffer, 'bankDocument')
  const key = bankDocumentKey(userUuid, Date.now(), processed.ext)
  await uploadFile(key, processed.buffer, processed.contentType)
  const documentUrl = getPublicUrl(key)

  const row = await db
    .insertInto('bank_change_requests')
    .values({
      user_id:        userId,
      bank_code:      input.bank_code,
      account_name:   input.account_name,
      account_number: input.account_number,
      reason:         input.reason ?? null,
      document_url:   documentUrl,
      status:         'pending',
    })
    .returning(['id', 'status', 'created_at'])
    .executeTakeFirstOrThrow()

  return { id: String(row.id), status: row.status, created_at: row.created_at }
}

// =============================================================
// Writer Dashboard
// =============================================================

export async function getWriterDashboard(userId: bigint) {
  // ดึง point, sales ของ writer
  const user = await db
    .selectFrom('users')
    .select(['point', 'sales', 'withdrawal_rate'])
    .where('id', '=', userId)
    .executeTakeFirstOrThrow()

  // นับจำนวนผลงาน
  const workCountRow = await db
    .selectFrom('works')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('author_id', '=', userId)
    .where('status', '=', 'active')
    .executeTakeFirstOrThrow()

  // นับ withdrawal ที่รอดำเนินการ
  const pendingWithdrawalRow = await db
    .selectFrom('withdrawals')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('user_id', '=', userId)
    .where('status', '=', 'pending')
    .executeTakeFirstOrThrow()

  // ส่วนแบ่งรายได้ที่ใช้จริง — สูตรเดียวกับ getWriterOverviewStats()/requestWithdrawal() เป๊ะ
  const rate = user.withdrawal_rate !== null ? Number(user.withdrawal_rate) : Number(process.env.WITHDRAWAL_RATE ?? '0.7')

  return {
    point:               String(user.point),   // เหรียญที่มีอยู่ตอนนี้ — คนละอันกับยอดเงินคงเหลือด้านล่าง (ใช้ซื้อตอนอ่าน ไม่ใช่รายได้)
    sales:               String(user.sales),   // ยอดขายสะสม (ก่อนหัก fee)
    // 2026-08-06 user ชี้บั๊กจริง: การ์ด "ยอดเงินคงเหลือ" (writer/overview) เดิมดึงจาก users.point
    // (เหรียญสำหรับซื้อตอนอ่าน — คนละก้อนเงินกันเลยกับรายได้นักเขียน) ที่ถูกคือ sales*rate (ยอดที่
    // จะได้จริงถ้ากดถอนตอนนี้ — สูตรเดียวกับ net_amount ใน requestWithdrawal()) ไม่รีเซ็ตรายเดือน
    // เพราะ users.sales เองก็ไม่รีเซ็ต (ลดลงเฉพาะตอนแอดมิน approve คำขอถอนจริงเท่านั้น — ดู
    // approveWithdrawal() ใน admin.service.ts)
    available_balance:  Math.floor(Number(user.sales) * rate * 100) / 100,
    work_count:          Number(workCountRow.total),
    pending_withdrawal:  Number(pendingWithdrawalRow.total),
  }
}

// =============================================================
// Writer Overview — "ภาพรวมนักเขียน" (2026-08-05, ใหม่)
// อิงจาก pdf อ้างอิงที่ user ส่งมา (readrealm.co/writer/overview) — สรุปยอดรวม "ทุกผลงาน" ของ
// นักเขียนคนเดียว (ต่างจาก getWorkStats ที่เจาะจงเรื่องเดียว) ตัดส่วน "ข้อมูลภาพรวมการ์ตูน" กับ
// "ยอด Donate" ออกจากที่ pdf มี เพราะระบบมังงะถูกตัดทิ้งไปนานแล้ว (user ยืนยันเอง 2026-08-05) และ
// ระบบไม่มีฟีเจอร์ donate อยู่เลยในโค้ด (เช็คแล้ว ไม่มี table/endpoint ไหนเกี่ยวข้องทั้งสิ้น)
// =============================================================

export async function getWriterOverviewStats(userId: bigint) {
  // ยอดขาย/รายได้/จำนวนการขาย "เดือนนี้" (2026-08-05 แก้ตามที่ user ขอ: การ์ดพวกนี้ต้องนับใหม่
  // ทุกวันที่ 1 ไม่ใช่สะสมตลอดกาล — ต่างจาก users.sales ที่ยังเป็นยอดสะสมตลอดกาล ใช้อ้างอิงใต้กราฟ
  // "รวมยอดขายทั้งหมดของบัญชี" อยู่ที่เดิม)
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))

  const [user, workRow, epRow, likeRow, bookmarkRow, commentRow, freeEpRow, monthSalesRow] = await Promise.all([
    db.selectFrom('users').select(['sales', 'withdrawal_rate']).where('id', '=', userId).executeTakeFirstOrThrow(),
    db
      .selectFrom('works')
      .select([
        ({ fn }) => fn.countAll<string>().as('work_count'),
        ({ fn }) => fn.sum<string>('view_count').as('views'),
      ])
      .where('author_id', '=', userId)
      .where('status', '=', 'active')
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('work_ep as e')
      .innerJoin('works as w', 'w.p_id', 'e.p_id')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('w.author_id', '=', userId)
      .where('w.status', '=', 'active')
      .where('e.status', '=', 'active')
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('work_favorite as f')
      .innerJoin('works as w', 'w.p_id', 'f.p_id')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('w.author_id', '=', userId)
      .where('w.status', '=', 'active')
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('work_bookmarks as b')
      .innerJoin('works as w', 'w.p_id', 'b.p_id')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('w.author_id', '=', userId)
      .where('w.status', '=', 'active')
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('work_comments as c')
      .innerJoin('works as w', 'w.p_id', 'c.work_id')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('w.author_id', '=', userId)
      .where('w.status', '=', 'active')
      .where('c.parent_id', 'is', null)
      .where('c.status', '=', 'active')
      .executeTakeFirstOrThrow(),
    // จำนวนตอนฟรี (2026-08-05 — ย้ายมาอยู่ "ข้อมูลภาพรวมนิยาย" ตามที่ user ขอ ตัด "จำนวนตอนขาย"
    // ออกไปเลย เพราะซ้ำความหมายกับ "จำนวนการขาย" ในสายตา user)
    db
      .selectFrom('work_ep as e')
      .innerJoin('works as w', 'w.p_id', 'e.p_id')
      .select(sql<string>`count(*) filter (where e.ep_price = 0)`.as('free'))
      .where('w.author_id', '=', userId)
      .where('w.status', '=', 'active')
      .where('e.status', '=', 'active')
      .executeTakeFirstOrThrow(),
    // ยอดขาย/จำนวนการขาย เฉพาะเดือนนี้ (นับจากวันที่ 1 ถึงตอนนี้)
    db
      .selectFrom('ep_shop as s')
      .innerJoin('works as w', 'w.p_id', 's.p_id')
      .select([
        ({ fn }) => fn.sum<string>('s.price').as('total'),
        ({ fn }) => fn.countAll<string>().as('count'),
      ])
      .where('w.author_id', '=', userId)
      .where('s.created_at', '>=', monthStart)
      .executeTakeFirstOrThrow(),
  ])

  // ส่วนแบ่งรายได้ที่ใช้จริง — ใช้ค่า override เฉพาะ user นี้ถ้ามีตั้งไว้ (users.withdrawal_rate)
  // ไม่งั้น fallback ไปใช้ค่ากลางจาก .env เดียวกับที่ requestWithdrawal() ใช้จริงตอนถอนเงิน
  const rate = user.withdrawal_rate !== null ? Number(user.withdrawal_rate) : Number(process.env.WITHDRAWAL_RATE ?? '0.7')
  const salesThisMonth = Number(monthSalesRow.total ?? 0)

  return {
    work_count:          Number(workRow.work_count),
    episode_count:       Number(epRow.count),
    view_count:          Number(workRow.views ?? 0),
    like_count:          Number(likeRow.count),
    bookmark_count:      Number(bookmarkRow.count),
    comment_count:       Number(commentRow.count),
    free_episode_count:  Number(freeEpRow.free),
    sales:               Number(user.sales),   // ยอดขายสะสมตลอดกาลของบัญชี — ใช้อ้างอิงใต้กราฟเท่านั้น
    revenue_share_percent:    Math.round(rate * 100),
    sales_this_month:         salesThisMonth,
    net_revenue_this_month:   Math.floor(salesThisMonth * rate * 100) / 100,
    sale_count_this_month:    Number(monthSalesRow.count),
    // 2026-08-06 user ชี้บั๊กจริง: เดิมดึงจาก users.point (เหรียญสำหรับซื้อตอนอ่าน — คนละก้อนเงิน
    // กับรายได้นักเขียนเลย) ที่ถูกคือ sales*rate (ยอดที่จะได้จริงถ้ากดถอนตอนนี้ — สูตรเดียวกับ
    // net_amount ใน requestWithdrawal()) ไม่รีเซ็ตรายเดือนเพราะ users.sales เองก็ไม่รีเซ็ต
    // (ลดลงเฉพาะตอนแอดมิน approve คำขอถอนจริงเท่านั้น — ดู approveWithdrawal() ใน admin.service.ts)
    available_balance:  Math.floor(Number(user.sales) * rate * 100) / 100,
  }
}

// ---- กราฟยอดขายรายวันภายในเดือนที่เลือก (รวมทุกผลงาน) — แท็บ "ภาพรวมนักเขียน" ----
export async function getWriterSalesMonthly(userId: bigint, year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 1))
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()

  const rows = await db
    .selectFrom('ep_shop as s')
    .innerJoin('works as w', 'w.p_id', 's.p_id')
    .select([
      sql<number>`extract(day from s.created_at)::int`.as('day'),
      ({ fn }) => fn.sum<string>('s.price').as('total'),
    ])
    .where('w.author_id', '=', userId)
    .where('s.created_at', '>=', start)
    .where('s.created_at', '<', end)
    .groupBy(sql`extract(day from s.created_at)`)
    .execute()

  const byDay = new Map(rows.map((r) => [r.day, Number(r.total)]))
  const daily = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, sales: byDay.get(i + 1) ?? 0 }))
  const monthTotal = daily.reduce((sum, d) => sum + d.sales, 0)

  return { daily, month_total: monthTotal }
}

// ---- กราฟยอดขายรายเดือนภายในปีที่เลือก (รวมทุกผลงาน) — โหมด "รายเดือน" ของกราฟรายได้ (2026-08-05) ----
export async function getWriterSalesYearly(userId: bigint, year: number) {
  const start = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year + 1, 0, 1))

  const rows = await db
    .selectFrom('ep_shop as s')
    .innerJoin('works as w', 'w.p_id', 's.p_id')
    .select([
      sql<number>`extract(month from s.created_at)::int`.as('month'),
      ({ fn }) => fn.sum<string>('s.price').as('total'),
    ])
    .where('w.author_id', '=', userId)
    .where('s.created_at', '>=', start)
    .where('s.created_at', '<', end)
    .groupBy(sql`extract(month from s.created_at)`)
    .execute()

  const byMonth = new Map(rows.map((r) => [r.month, Number(r.total)]))
  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, sales: byMonth.get(i + 1) ?? 0 }))
  const yearTotal = monthly.reduce((sum, m) => sum + m.sales, 0)

  return { monthly, year_total: yearTotal }
}

// ---- กราฟยอดขายรายปี — โหมด "ตลอด" ของกราฟรายได้ (2026-08-05)
// user ขอเพิ่มเอง ไม่มีใน pdf อ้างอิง — "ดูทั้งหมด จะขึ้นเป็นแบ่งแบบปี" คือทุกปีที่มีข้อมูลจริง
// ไม่ใช่ล็อกไว้แค่ 5 ปีย้อนหลัง (เดิมทำแบบนั้นตอนโหมดนี้ยังชื่อ "รายปี" ก่อนแก้ตามรอบนี้) — หา
// ปีแรกที่มียอดขายจริงจาก MIN(created_at) ก่อน แล้วไล่ตั้งแต่ปีนั้นถึงปีปัจจุบัน ถ้าไม่เคยมียอดขาย
// เลยสักครั้ง ให้โชว์แค่ปีปัจจุบันปีเดียว (ค่า 0) กันกราฟว่างเปล่าไม่มีอะไรให้ดู
export async function getWriterSalesByYear(userId: bigint) {
  const currentYear = new Date().getUTCFullYear()

  const earliestRow = await db
    .selectFrom('ep_shop as s')
    .innerJoin('works as w', 'w.p_id', 's.p_id')
    .select(sql<Date | null>`min(s.created_at)`.as('earliest'))
    .where('w.author_id', '=', userId)
    .executeTakeFirst()

  const startYear = earliestRow?.earliest ? new Date(earliestRow.earliest).getUTCFullYear() : currentYear
  const start = new Date(Date.UTC(startYear, 0, 1))

  const rows = await db
    .selectFrom('ep_shop as s')
    .innerJoin('works as w', 'w.p_id', 's.p_id')
    .select([
      sql<number>`extract(year from s.created_at)::int`.as('year'),
      ({ fn }) => fn.sum<string>('s.price').as('total'),
    ])
    .where('w.author_id', '=', userId)
    .where('s.created_at', '>=', start)
    .groupBy(sql`extract(year from s.created_at)`)
    .execute()

  const byYear = new Map(rows.map((r) => [r.year, Number(r.total)]))
  const yearCount = currentYear - startYear + 1
  const yearly = Array.from({ length: yearCount }, (_, i) => {
    const y = startYear + i
    return { year: y, sales: byYear.get(y) ?? 0 }
  })

  return { yearly }
}

// ---- กราฟยอดขายรายชั่วโมง (24 ชม.ล่าสุดแบบ rolling) — โหมด "วัน" ของกราฟรายได้ (2026-08-05)
// user ขอเพิ่มเอง (ไม่มีใน pdf) — "ถ้าเป็นวัน จะดูเป็นหลักชั่วโมงว่าขายได้เท่าไหร่ โดยเริ่มนับ 24 ชม.
// ปรับวันย้อนไม่ได้ เป็น Report ล่าสุดเฉยๆ" — ไม่มี parameter ให้เลือกวันย้อนหลังเลยตามที่ขอ ตัดจาก
// "ตอนนี้" ย้อนไป 24 ชม.เป๊ะ ไม่ใช่ตัดที่เที่ยงคืน
export async function getWriterSalesHourly(userId: bigint) {
  const now = new Date()
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const rows = await db
    .selectFrom('ep_shop as s')
    .innerJoin('works as w', 'w.p_id', 's.p_id')
    .select([
      sql<number>`extract(epoch from (s.created_at - ${start}::timestamptz)) / 3600`.as('hours_ago'),
      's.price',
    ])
    .where('w.author_id', '=', userId)
    .where('s.created_at', '>=', start)
    .execute()

  // group เป็น bucket รายชั่วโมงเอง (0 = ชม.แรกสุดของช่วง 24 ชม., 23 = ชม.ล่าสุด/ปัจจุบัน) —
  // ทำใน JS แทน SQL group by ตรงๆ เพราะ bucket ขยับตาม "ตอนนี้" ทุกครั้งที่ query (rolling window
  // ไม่ใช่ calendar hour คงที่แบบ extract(hour))
  const buckets = new Array(24).fill(0)
  for (const r of rows) {
    const idx = Math.min(23, Math.max(0, Math.floor(Number(r.hours_ago))))
    buckets[idx] += Number(r.price)
  }

  const hourly = buckets.map((sales, i) => {
    const bucketTime = new Date(start.getTime() + i * 60 * 60 * 1000)
    return { label: `${String(bucketTime.getUTCHours()).padStart(2, '0')}:00`, sales }
  })
  const total = hourly.reduce((sum, h) => sum + h.sales, 0)

  return { hourly, total }
}

// ---- "เรื่องขายดี" — จัดอันดับผลงานตัวเองตามยอดขาย (เหรียญ) ในช่วงเวลาที่เลือก (2026-08-05, ใหม่)
// user ขอเพิ่มเอง (ไม่มีใน pdf) — แก้รอบ 2 (2026-08-05): เดิมเป็นปฏิทิน (week=จันทร์-ปัจจุบัน,
// month=วันที่1-ปัจจุบัน, year=ม.ค.-ปัจจุบัน) user บอกว่าไม่ใช่แบบนั้น อยากได้ "นับรวมทั้งหมด" แบบ
// rolling window ธรรมดา: 7 วันที่ผ่านมา, 30 วันที่ผ่านมา (ตัด "ปี" ออก เหลือ 2 ช่วงตามที่ user
// ระบุ) — ยอดรวมแต่ละเรื่องแข่งกันเอง เรื่องไหนมากกว่าก็แซงขึ้นอันดับเอง (ORDER BY total_sales desc
// ธรรมดา ไม่ต้องทำอะไรพิเศษ)
export async function getWriterTopSellingWorks(
  userId: bigint,
  period: '7d' | '30d',
  limit: number,
) {
  const now = new Date()
  const days = period === '7d' ? 7 : 30
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  const rows = await db
    .selectFrom('ep_shop as s')
    .innerJoin('works as w', 'w.p_id', 's.p_id')
    .select([
      'w.uuid', 'w.title', 'w.cover_image',
      ({ fn }) => fn.sum<string>('s.price').as('total_sales'),
      ({ fn }) => fn.countAll<string>().as('sale_count'),
    ])
    .where('w.author_id', '=', userId)
    .where('w.status', '=', 'active')
    .where('s.created_at', '>=', start)
    .groupBy(['w.uuid', 'w.title', 'w.cover_image'])
    .orderBy('total_sales', 'desc')
    .limit(limit)
    .execute()

  return rows.map((r) => ({
    uuid:         r.uuid,
    title:        r.title,
    cover_image:  r.cover_image,
    total_sales:  Number(r.total_sales),
    sale_count:   Number(r.sale_count),
  }))
}

// ---- "ประวัติรายได้ (ขาย)" — log รายทรานแซกชันการขายตอน ค้นหาผู้ซื้อได้ (2026-08-05, ใหม่)
// ตาม pdf "ReadToon Creator" (คอลัมน์: วันที่/ผู้ใช้/เนื้อหา/ตอน/จำนวนเงิน) — ค้นหาด้วย
// username/ชื่อที่แสดงของผู้ซื้อ (pdf มีช่องอีเมลด้วย แต่ไม่โชว์อีเมลผู้ซื้อคนอื่นให้นักเขียนเห็น
// ตั้งใจตัดออกเพื่อความเป็นส่วนตัว — username ค้นหาได้เทียบเท่ากันอยู่แล้ว)
export async function getWriterSalesHistory(
  userId: bigint,
  page: number,
  limit: number,
  search?: string,
) {
  const offset = (page - 1) * limit

  let query = db
    .selectFrom('ep_shop as s')
    .innerJoin('works as w', 'w.p_id', 's.p_id')
    .innerJoin('users as u', 'u.id', 's.user_id')
    .select([
      's.id', 's.ep_no', 's.price', 's.created_at',
      'w.title as work_title',
      'u.uuid as buyer_uuid', 'u.u_name as buyer_u_name', 'u.display_name as buyer_display_name',
    ])
    .where('w.author_id', '=', userId)

  let countQuery = db
    .selectFrom('ep_shop as s')
    .innerJoin('works as w', 'w.p_id', 's.p_id')
    .innerJoin('users as u', 'u.id', 's.user_id')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('w.author_id', '=', userId)

  if (search) {
    const term = `%${search}%`
    query = query.where((eb) => eb.or([eb('u.u_name', 'ilike', term), eb('u.display_name', 'ilike', term)]))
    countQuery = countQuery.where((eb) => eb.or([eb('u.u_name', 'ilike', term), eb('u.display_name', 'ilike', term)]))
  }

  const [rows, countRow] = await Promise.all([
    query.orderBy('s.created_at', 'desc').limit(limit).offset(offset).execute(),
    countQuery.executeTakeFirstOrThrow(),
  ])
  const total = Number(countRow.total)

  return {
    data: rows.map((r) => ({
      id:         String(r.id),
      created_at: r.created_at,
      ep_no:      r.ep_no,
      price:      Number(r.price),
      work_title: r.work_title,
      buyer: { uuid: r.buyer_uuid, u_name: r.buyer_u_name, display_name: r.buyer_display_name },
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

// =============================================================
// Report Functions (migration 032) — "รายงานที่ได้รับ"
// รายงานจากนักอ่าน (content_reports หมวด 'content_error' เท่านั้น — routing มาจาก
// reportContent() ใน social.service.ts, ดู lib/report-categories.ts) รายงานหมวดอื่นทั้งหมด
// ยังคงเข้าคิวแอดมินตามเดิม ไม่โผล่ที่นี่
// =============================================================

export async function getWriterReceivedReports(writerId: bigint, page: number, limit: number) {
  const offset = (page - 1) * limit

  const rows = await db
    .selectFrom('content_reports as r')
    .innerJoin('users as reporter', 'reporter.id', 'r.reported_by')
    .select([
      'r.id', 'r.target_type', 'r.target_id', 'r.reason', 'r.status',
      'r.writer_note', 'r.writer_acknowledged_at', 'r.created_at',
      'reporter.display_name as reporter_display_name',
    ])
    .where('r.work_author_id', '=', writerId)
    .where('r.category', '=', 'content_error')
    .orderBy('r.created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  const countRow = await db
    .selectFrom('content_reports')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('work_author_id', '=', writerId)
    .where('category', '=', 'content_error')
    .executeTakeFirstOrThrow()
  const total = Number(countRow.total)

  // batch resolve preview ของเป้าหมาย — แยก query ตาม target_type เหมือน listContentReports ฝั่งแอดมิน
  const commentIds = rows.filter((r) => r.target_type === 'comment').map((r) => r.target_id)
  const workIds = rows.filter((r) => r.target_type === 'work').map((r) => r.target_id)

  const [commentRows, workRows] = await Promise.all([
    commentIds.length
      ? db.selectFrom('work_comments as c')
          .innerJoin('works as w', 'w.p_id', 'c.work_id')
          .select(['c.id', 'c.content', 'w.uuid as work_uuid', 'w.title as work_title'])
          .where('c.id', 'in', commentIds)
          .execute()
      : Promise.resolve([]),
    workIds.length
      ? db.selectFrom('works')
          .select(['p_id', 'uuid', 'title'])
          .where('p_id', 'in', workIds)
          .execute()
      : Promise.resolve([]),
  ])

  const commentMap = new Map(commentRows.map((c) => [String(c.id), c]))
  const workMap = new Map(workRows.map((w) => [String(w.p_id), w]))

  return {
    data: rows.map((r) => {
      const idStr = String(r.target_id)
      const c = r.target_type === 'comment' ? commentMap.get(idStr) : undefined
      const w = r.target_type === 'work' ? workMap.get(idStr) : undefined
      const target = c
        ? { preview: c.content, work_uuid: c.work_uuid, work_title: c.work_title }
        : w
        ? { preview: w.title, work_uuid: w.uuid, work_title: w.title }
        : { preview: null, work_uuid: null, work_title: null }

      return {
        id:                     String(r.id),
        target_type:            r.target_type,
        target,
        reason:                 r.reason,
        status:                 r.status,
        writer_note:            r.writer_note,
        writer_acknowledged_at: r.writer_acknowledged_at,
        created_at:             r.created_at,
        reported_by:            r.reporter_display_name,
      }
    }),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

// ---- นักเขียนตอบกลับสั้นๆ (หมายเหตุ) เพื่อแสดงว่าเห็นแล้ว — ไม่เปลี่ยน status ของรายงาน
// (status ยังเป็นหน้าที่แอดมินคุมอยู่เหมือนเดิม) แอดมินเห็น writer_note นี้ในคิวเดิมของตัวเองด้วย
export async function acknowledgeReport(writerId: bigint, reportId: bigint, note: string) {
  const report = await db
    .selectFrom('content_reports')
    .select(['id', 'work_author_id'])
    .where('id', '=', reportId)
    .executeTakeFirst()

  if (!report) throw new Error('REPORT_NOT_FOUND')
  if (report.work_author_id === null || BigInt(report.work_author_id) !== writerId) throw new Error('NOT_YOUR_REPORT')

  const trimmed = note.trim()
  if (!trimmed) throw new Error('EMPTY_NOTE')

  await db
    .updateTable('content_reports')
    .set({ writer_note: trimmed, writer_acknowledged_at: new Date() })
    .where('id', '=', reportId)
    .execute()
}

// =============================================================
// Admin Notice Functions (migration 032) — "รายงานจากแอดมิน"
// แอดมินส่งรายงาน/แจ้งเตือนถึงนักเขียนตรงๆ จากหน้าจัดการผลงานเรื่องนั้น (createWriterNotice
// ใน admin.service.ts) — นักเขียนดูได้อย่างเดียว ตอบกลับสั้นๆ ได้เหมือนรายงานจากนักอ่าน
// =============================================================

export async function getWriterAdminNotices(writerId: bigint, page: number, limit: number) {
  const offset = (page - 1) * limit

  const rows = await db
    .selectFrom('writer_admin_notices as n')
    .leftJoin('works as w', 'w.p_id', 'n.work_id')
    .leftJoin('users as a', 'a.id', 'n.admin_id')
    .select([
      'n.id', 'n.subject', 'n.message', 'n.severity', 'n.source', 'n.metadata',
      'n.writer_note', 'n.writer_acknowledged_at', 'n.created_at',
      'w.uuid as work_uuid', 'w.title as work_title',
      'a.display_name as admin_display_name',
    ])
    .where('n.writer_id', '=', writerId)
    .orderBy('n.created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  const countRow = await db
    .selectFrom('writer_admin_notices')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('writer_id', '=', writerId)
    .executeTakeFirstOrThrow()
  const total = Number(countRow.total)

  return {
    data: rows.map((r) => ({
      id:                     String(r.id),
      subject:                r.subject,
      message:                r.message,
      severity:               r.severity,
      source:                 r.source,
      metadata:               r.metadata,
      writer_note:            r.writer_note,
      writer_acknowledged_at: r.writer_acknowledged_at,
      created_at:             r.created_at,
      work:                   r.work_uuid ? { uuid: r.work_uuid, title: r.work_title } : null,
      sender_name:            r.source === 'system_action' ? 'อัตโนมัติ' : (r.admin_display_name ?? 'ผู้ดูแล'),
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

export async function acknowledgeAdminNotice(writerId: bigint, noticeId: bigint, note: string) {
  const notice = await db
    .selectFrom('writer_admin_notices')
    .select(['id', 'writer_id'])
    .where('id', '=', noticeId)
    .executeTakeFirst()

  if (!notice) throw new Error('NOTICE_NOT_FOUND')
  if (BigInt(notice.writer_id) !== writerId) throw new Error('NOT_YOUR_NOTICE')

  const trimmed = note.trim()
  if (!trimmed) throw new Error('EMPTY_NOTE')

  await db
    .updateTable('writer_admin_notices')
    .set({ writer_note: trimmed, writer_acknowledged_at: new Date(), updated_at: new Date() })
    .where('id', '=', noticeId)
    .execute()
}
