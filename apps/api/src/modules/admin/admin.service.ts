// =============================================================
// Novel Platform — Admin Service
// วางไว้ที่: apps/api/src/modules/admin/admin.service.ts
// =============================================================

import { db } from '../../db'
import { sql } from 'kysely'
import { uploadFile, deleteFile, getPublicUrl, getKeyFromUrl, carouselKey, withdrawalProofKey, isAllowedImageType } from '../../lib/r2'
import { processImage } from '../../lib/image'
import type { ReportCategory } from '../../lib/report-categories'

// =============================================================
// Helper: เขียน Audit Log
// audit_logs ใน DB ใช้: user_id, event_type, description, metadata
// =============================================================

export async function writeAuditLog(
  adminId:    bigint,
  eventType:  string,
  targetType: string,
  targetId:   string,
  note?:      string,
) {
  await db
    .insertInto('audit_logs')
    .values({
      user_id:    adminId,
      event_type: eventType,
      description: note
        ? `[${targetType}:${targetId}] ${note}`
        : `[${targetType}:${targetId}]`,
      metadata: JSON.stringify({ target_type: targetType, target_id: targetId, note: note ?? null }),
    })
    .execute()
}

// =============================================================
// User Management
// =============================================================

// ---- สถิติบัญชี (2026-07-30, ขยายเพิ่ม 2026-07-30 สำหรับหน้า "จัดการผู้ใช้" เวอร์ชันเต็ม) ----
// อัตราการอ่านใน 1 วัน = จำนวนเรื่อง (distinct) ที่กดเข้าไปอ่านใน 24 ชม.ที่ผ่านมา (work_ep_views)
// เหรียญที่ใช้ต่อสัปดาห์ = ผลรวม delta ฝั่งลบของ coin_ledger (reason='purchase') ใน 7 วันที่ผ่านมา
// เพิ่ม: ยอดอ่านต่อเดือน (นับเป็น "ตอน" ไม่ใช่ "เรื่อง" ต่างจาก reads_today — นับทุกแถวใน
// work_ep_views ใน 30 วัน ไม่ distinct เพราะ user ขอ "นับจากตอน"), ใช้ไปต่อเดือน, login ล่าสุด
// (จาก login_history ที่เพิ่งทำ), สถานะระงับ 2 แบบ (จาก migration 027)
// ทำเป็น batch query แยกต่างหาก (ไม่ join/subquery ต่อแถว) ให้ตรงกับ convention เดิมของโปรเจกต์
// (ดู getWorkCounts() ใน works.service.ts ที่ทำแบบเดียวกัน)
export interface AccountStats {
  reads_today: number
  coins_spent_week: string
  reads_month: number
  coins_spent_month: string
  last_login_at: Date | null
  is_activity_suspended: boolean
  is_spend_suspended: boolean
}

async function getAccountStatsBatch(userIds: bigint[]): Promise<Map<string, AccountStats>> {
  if (userIds.length === 0) return new Map()

  const [readTodayRows, spentWeekRows, readMonthRows, spentMonthRows, lastLoginRows, activeSuspRows, spendSuspRows] =
    await Promise.all([
      db
        .selectFrom('work_ep_views')
        .select(['user_id', ({ fn }) => fn.count<string>('p_id').distinct().as('c')])
        .where('user_id', 'in', userIds)
        .where(sql<boolean>`created_at >= now() - interval '1 day'`)
        .groupBy('user_id')
        .execute(),
      db
        .selectFrom('coin_ledger')
        .select(['user_id', ({ fn }) => fn.sum<string>('delta').as('s')])
        .where('user_id', 'in', userIds)
        .where('reason', '=', 'purchase')
        .where(sql<boolean>`created_at >= now() - interval '7 days'`)
        .groupBy('user_id')
        .execute(),
      // นับ "ตอน" ไม่ distinct work — 1 แถวใน work_ep_views = 1 ครั้งที่เปิดอ่านตอนนั้น
      db
        .selectFrom('work_ep_views')
        .select(['user_id', ({ fn }) => fn.countAll<string>().as('c')])
        .where('user_id', 'in', userIds)
        .where(sql<boolean>`created_at >= now() - interval '30 days'`)
        .groupBy('user_id')
        .execute(),
      db
        .selectFrom('coin_ledger')
        .select(['user_id', ({ fn }) => fn.sum<string>('delta').as('s')])
        .where('user_id', 'in', userIds)
        .where('reason', '=', 'purchase')
        .where(sql<boolean>`created_at >= now() - interval '30 days'`)
        .groupBy('user_id')
        .execute(),
      db
        .selectFrom('login_history')
        .select(['user_id', ({ fn }) => fn.max('created_at').as('last_login')])
        .where('user_id', 'in', userIds)
        .where('success', '=', true)
        .groupBy('user_id')
        .execute(),
      db
        .selectFrom('user_activity_suspensions')
        .select('user_id')
        .distinct()
        .where('user_id', 'in', userIds)
        .where('lifted_at', 'is', null)
        .execute(),
      db
        .selectFrom('user_spend_suspensions')
        .select('user_id')
        .distinct()
        .where('user_id', 'in', userIds)
        .where('lifted_at', 'is', null)
        .execute(),
    ])

  const readTodayMap = new Map(readTodayRows.map((r) => [String(r.user_id), Number(r.c)]))
  const spentWeekMap = new Map(spentWeekRows.map((r) => [String(r.user_id), r.s]))
  const readMonthMap = new Map(readMonthRows.map((r) => [String(r.user_id), Number(r.c)]))
  const spentMonthMap = new Map(spentMonthRows.map((r) => [String(r.user_id), r.s]))
  const lastLoginMap = new Map(lastLoginRows.map((r) => [String(r.user_id), r.last_login as Date | null]))
  const activeSuspSet = new Set(activeSuspRows.map((r) => String(r.user_id)))
  const spendSuspSet = new Set(spendSuspRows.map((r) => String(r.user_id)))

  const result = new Map<string, AccountStats>()
  for (const id of userIds) {
    const key = String(id)
    // delta ฝั่งซื้อเป็นค่าลบเสมอ (ดู CoinLedgerTable comment) — กลับเครื่องหมายให้เป็น "ใช้ไปเท่าไหร่"
    const rawSpentWeek = spentWeekMap.get(key)
    const rawSpentMonth = spentMonthMap.get(key)
    result.set(key, {
      reads_today: readTodayMap.get(key) ?? 0,
      coins_spent_week: rawSpentWeek ? String(-BigInt(rawSpentWeek)) : '0',
      reads_month: readMonthMap.get(key) ?? 0,
      coins_spent_month: rawSpentMonth ? String(-BigInt(rawSpentMonth)) : '0',
      last_login_at: lastLoginMap.get(key) ?? null,
      is_activity_suspended: activeSuspSet.has(key),
      is_spend_suspended: spendSuspSet.has(key),
    })
  }
  return result
}

// ---- สถิตินักเขียน (2026-08-04, ใช้กับแท็บ "นักเขียนของเว็บ" เท่านั้น) ----
// ตัวเลขเดียวกับที่หน้าโปรไฟล์เว็บ (apps/web) โชว์อยู่แล้ว (getProfileStats() ใน
// apps/api/src/modules/user/user.service.ts มุมมอง isWriter=true — sum(view_count)/
// bookmark/favorite/comment รวมจากผลงาน active ทั้งหมด + follower/following) แค่ทำเป็น
// batch query (ไม่ query ทีละคนต่อแถว) ให้ตรงกับ convention getAccountStatsBatch() ด้านบน
// เพิ่ม work_count (จำนวนผลงาน) ที่ฝั่งโปรไฟล์เว็บไม่มีโชว์แต่ตาราง admin นี้ user ขอเพิ่ม
export interface WriterStats {
  work_count:      number
  read_count:      number
  bookmark_count:  number
  favorite_count:  number
  comment_count:   number
  follower_count:  number
  following_count: number
}

async function getWriterStatsBatch(userIds: bigint[]): Promise<Map<string, WriterStats>> {
  if (userIds.length === 0) return new Map()

  const [workRows, bookmarkRows, favoriteRows, commentRows, followerRows, followingRows] = await Promise.all([
    db
      .selectFrom('works')
      .select([
        'author_id',
        ({ fn }) => fn.countAll<string>().as('c'),
        ({ fn }) => fn.sum<string | null>('view_count').as('views'),
      ])
      .where('author_id', 'in', userIds)
      .where('status', '=', 'active')
      .groupBy('author_id')
      .execute(),
    db
      .selectFrom('work_bookmarks as b')
      .innerJoin('works as w', 'w.p_id', 'b.p_id')
      .select(['w.author_id', ({ fn }) => fn.countAll<string>().as('c')])
      .where('w.author_id', 'in', userIds)
      .where('w.status', '=', 'active')
      .groupBy('w.author_id')
      .execute(),
    db
      .selectFrom('work_favorite as f')
      .innerJoin('works as w', 'w.p_id', 'f.p_id')
      .select(['w.author_id', ({ fn }) => fn.countAll<string>().as('c')])
      .where('w.author_id', 'in', userIds)
      .where('w.status', '=', 'active')
      .groupBy('w.author_id')
      .execute(),
    db
      .selectFrom('work_comments as c')
      .innerJoin('works as w', 'w.p_id', 'c.work_id')
      .select(['w.author_id', ({ fn }) => fn.countAll<string>().as('c')])
      .where('w.author_id', 'in', userIds)
      .where('w.status', '=', 'active')
      .where('c.status', '=', 'active')
      .where('c.parent_id', 'is', null) // นับเฉพาะคอมเม้นระดับบนสุด ตรงกับ getProfileStats()
      .groupBy('w.author_id')
      .execute(),
    db
      .selectFrom('user_followers')
      .select(['following_id', ({ fn }) => fn.countAll<string>().as('c')])
      .where('following_id', 'in', userIds)
      .groupBy('following_id')
      .execute(),
    db
      .selectFrom('user_followers')
      .select(['follower_id', ({ fn }) => fn.countAll<string>().as('c')])
      .where('follower_id', 'in', userIds)
      .groupBy('follower_id')
      .execute(),
  ])

  const workMap      = new Map(workRows.map((r) => [String(r.author_id), r]))
  const bookmarkMap  = new Map(bookmarkRows.map((r) => [String(r.author_id), Number(r.c)]))
  const favoriteMap  = new Map(favoriteRows.map((r) => [String(r.author_id), Number(r.c)]))
  const commentMap   = new Map(commentRows.map((r) => [String(r.author_id), Number(r.c)]))
  const followerMap  = new Map(followerRows.map((r) => [String(r.following_id), Number(r.c)]))
  const followingMap = new Map(followingRows.map((r) => [String(r.follower_id), Number(r.c)]))

  const result = new Map<string, WriterStats>()
  for (const id of userIds) {
    const key = String(id)
    const w = workMap.get(key)
    result.set(key, {
      work_count:      w ? Number(w.c) : 0,
      read_count:      w ? Number(w.views ?? 0) : 0, // sum ของ 0 แถวคืน null (ยังไม่มีผลงาน)
      bookmark_count:  bookmarkMap.get(key) ?? 0,
      favorite_count:  favoriteMap.get(key) ?? 0,
      comment_count:   commentMap.get(key) ?? 0,
      follower_count:  followerMap.get(key) ?? 0,
      following_count: followingMap.get(key) ?? 0,
    })
  }
  return result
}

export async function listUsers(params: {
  page:       number
  limit:      number
  search?:    string
  level?:     number
  /** กรอง "level >= ค่านี้" แทนตรงตัวเป๊ะ — ใช้กับค้นหาแอดมิน (min_level=8 ในหน้า
      "ข้อมูลบัญชีแอดมิน") */
  min_level?: number
  is_banned?: boolean
  /** ใช้กับแท็บ "นักเขียนของเว็บ" เท่านั้น (2026-08-04 user ขอ) — โชว์เฉพาะ (level 6-7)
      OR (มีผลงานอัพโหลดจริงอย่างน้อย 1 เรื่อง สถานะ active) กันแอดมิน (8/9/10) ที่ level
      สูงกว่าติดมาโดยไม่ได้เป็นนักเขียนจริง แต่ถ้าแอดมินมีผลงานจริง (เผื่อไว้เทส) ก็ยังให้โชว์ */
  writers_only?: boolean
}) {
  const { page, limit, search, level, min_level, is_banned, writers_only } = params
  const offset = (page - 1) * limit

  // user_bans: ไม่มี banned_until — ban ทั้งหมดเป็น permanent จนกว่าจะ unban
  // เช็ค active ban ด้วย unbanned_at IS NULL
  let query = db
    .selectFrom('users as u')
    .leftJoin('user_bans as b', (join) =>
      join
        .onRef('b.user_id', '=', 'u.id')
        .on('b.unbanned_at', 'is', null)
    )
    .leftJoin(
      (eb) => eb.selectFrom('works').select('author_id').distinct().where('status', '=', 'active').as('w'),
      (join) => join.onRef('w.author_id', '=', 'u.id'),
    )
    // 2026-08-12 — บัญชีที่สร้างผ่านหน่วยรบ (admin/squad) แล้วยกเป็น level 7 ทีหลัง ยังต้องรู้ว่า
    // ใครสร้างไว้ตั้งแต่แรก (created_by_admin_id ติดมากับแถวเดิม ไม่ถูกล้างตอนเปลี่ยน level)
    .leftJoin('users as creator', 'creator.id', 'u.created_by_admin_id')
    .select([
      'u.id',
      'u.uuid',
      'u.display_name',
      'u.u_name',
      'u.email',
      'u.level',
      'u.point',
      'u.sales',
      'u.created_at',
      'b.id as ban_id',
      'b.reason as ban_reason',
      'b.created_at as banned_at',
      'creator.uuid as creator_uuid',
      'creator.display_name as creator_display_name',
    ])

  if (search) {
    query = query.where((eb) =>
      eb.or([
        eb('u.display_name', 'ilike', `%${search}%`),
        eb('u.email',        'ilike', `%${search}%`),
        eb('u.u_name',       'ilike', `%${search}%`),
      ])
    )
  }

  if (level !== undefined) query = query.where('u.level', '=', level)
  if (min_level !== undefined) query = query.where('u.level', '>=', min_level)
  if (is_banned !== undefined) {
    query = is_banned
      ? query.where('b.id', 'is not', null)
      : query.where('b.id', 'is', null)
  }
  if (writers_only) {
    query = query.where((eb) =>
      eb.or([
        eb.and([eb('u.level', '>=', 6), eb('u.level', '<=', 7)]),
        eb('w.author_id', 'is not', null),
      ])
    )
  }

  const rows = await query
    .orderBy('u.created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  let countQuery = db
    .selectFrom('users as u')
    .leftJoin('user_bans as b', (join) =>
      join
        .onRef('b.user_id', '=', 'u.id')
        .on('b.unbanned_at', 'is', null)
    )
    .leftJoin(
      (eb) => eb.selectFrom('works').select('author_id').distinct().where('status', '=', 'active').as('w'),
      (join) => join.onRef('w.author_id', '=', 'u.id'),
    )
    .select(({ fn }) => fn.countAll<string>().as('total'))

  if (search) {
    countQuery = countQuery.where((eb) =>
      eb.or([
        eb('u.display_name', 'ilike', `%${search}%`),
        eb('u.email',        'ilike', `%${search}%`),
        eb('u.u_name',       'ilike', `%${search}%`),
      ])
    )
  }

  if (level !== undefined) countQuery = countQuery.where('u.level', '=', level)
  if (min_level !== undefined) countQuery = countQuery.where('u.level', '>=', min_level)
  if (is_banned !== undefined) {
    countQuery = is_banned
      ? countQuery.where('b.id', 'is not', null)
      : countQuery.where('b.id', 'is', null)
  }
  if (writers_only) {
    countQuery = countQuery.where((eb) =>
      eb.or([
        eb.and([eb('u.level', '>=', 6), eb('u.level', '<=', 7)]),
        eb('w.author_id', 'is not', null),
      ])
    )
  }

  const countRow = await countQuery.executeTakeFirstOrThrow()
  const total    = Number(countRow.total)

  const statsMap = await getAccountStatsBatch(rows.map((r) => r.id))
  // สถิตินักเขียน (ผู้ติดตาม/อ่านแล้ว/เก็บเข้าคลัง/หัวใจ/ความคิดเห็น/จำนวนผลงาน) คิดเฉพาะตอน
  // writers_only เท่านั้น (แท็บ "นักเขียนของเว็บ") — หน้าอื่นที่ใช้ listUsers() ร่วมกัน (จัดการ
  // ผู้ใช้/จัดการสิทธิ์/ข้อมูลบัญชีแอดมิน) ไม่ต้องเสีย query เพิ่มโดยไม่ได้ใช้
  const writerStatsMap = writers_only ? await getWriterStatsBatch(rows.map((r) => r.id)) : null

  return {
    data: rows.map((r) => {
      const stats = statsMap.get(String(r.id))
      const wstats = writerStatsMap?.get(String(r.id))
      return {
        id:           String(r.id),
        uuid:         r.uuid,
        display_name: r.display_name,
        u_name:       r.u_name,
        email:        r.email,
        level:        r.level,
        point:        String(r.point),
        sales:        String(r.sales),
        created_at:   r.created_at,
        is_banned:    r.ban_id !== null,
        ban_reason:   r.ban_reason ?? null,
        banned_at:    r.banned_at  ?? null,
        creator: r.creator_uuid ? { uuid: r.creator_uuid, display_name: r.creator_display_name } : null,
        reads_today:            stats?.reads_today ?? 0,
        coins_spent_week:       stats?.coins_spent_week ?? '0',
        reads_month:            stats?.reads_month ?? 0,
        coins_spent_month:      stats?.coins_spent_month ?? '0',
        last_login_at:          stats?.last_login_at ?? null,
        is_activity_suspended:  stats?.is_activity_suspended ?? false,
        is_spend_suspended:     stats?.is_spend_suspended ?? false,
        ...(wstats ? {
          work_count:      wstats.work_count,
          read_count:      wstats.read_count,
          bookmark_count:  wstats.bookmark_count,
          favorite_count:  wstats.favorite_count,
          comment_count:   wstats.comment_count,
          follower_count:  wstats.follower_count,
          following_count: wstats.following_count,
        } : {}),
      }
    }),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

export async function getUserDetail(uuid: string) {
  const user = await db
    .selectFrom('users as u')
    .leftJoin('user_bans as b', (join) =>
      join
        .onRef('b.user_id', '=', 'u.id')
        .on('b.unbanned_at', 'is', null)
    )
    .select([
      'u.id', 'u.uuid', 'u.display_name', 'u.u_name',
      'u.email', 'u.level', 'u.point', 'u.sales',
      'u.user_img', 'u.created_at', 'u.updated_at',
      'u.deleted_at', 'u.deletion_reason',
      'b.id as ban_id',
      'b.reason as ban_reason',
      'b.created_at as banned_at',
    ])
    .where('u.uuid', '=', uuid)
    .executeTakeFirst()

  if (!user) throw new Error('USER_NOT_FOUND')

  const stats = (await getAccountStatsBatch([user.id])).get(String(user.id))

  // เหตุผลของการระงับ 2 แบบ (ต่างจากแค่ true/false ใน list) — โชว์ในหน้ารายละเอียดให้ครบ
  const [activitySusp, spendSusp] = await Promise.all([
    db
      .selectFrom('user_activity_suspensions')
      .select(['reason', 'created_at'])
      .where('user_id', '=', user.id)
      .where('lifted_at', 'is', null)
      .executeTakeFirst(),
    db
      .selectFrom('user_spend_suspensions')
      .select(['reason', 'created_at'])
      .where('user_id', '=', user.id)
      .where('lifted_at', 'is', null)
      .executeTakeFirst(),
  ])

  return {
    id:           String(user.id),
    uuid:         user.uuid,
    display_name: user.display_name,
    u_name:       user.u_name,
    email:        user.email,
    level:        user.level,
    point:        String(user.point),
    sales:        String(user.sales),
    user_img:     user.user_img,
    created_at:   user.created_at,
    updated_at:   user.updated_at,
    is_banned:    user.ban_id !== null,
    ban_reason:   user.ban_reason ?? null,
    banned_at:    user.banned_at  ?? null,
    is_deleted:      user.deleted_at !== null,
    deletion_reason: user.deletion_reason ?? null,
    reads_today:              stats?.reads_today ?? 0,
    coins_spent_week:         stats?.coins_spent_week ?? '0',
    reads_month:              stats?.reads_month ?? 0,
    coins_spent_month:        stats?.coins_spent_month ?? '0',
    last_login_at:            stats?.last_login_at ?? null,
    is_activity_suspended:    activitySusp !== undefined,
    activity_suspended_reason: activitySusp?.reason ?? null,
    activity_suspended_at:     activitySusp?.created_at ?? null,
    is_spend_suspended:        spendSusp !== undefined,
    spend_suspended_reason:    spendSusp?.reason ?? null,
    spend_suspended_at:        spendSusp?.created_at ?? null,
  }
}

// =============================================================
// User Detail — Dynamic Tabs (migration 027, 2026-07-30)
// ข้อมูลชุดที่สลับดูได้ในหน้ารายละเอียดผู้ใช้ (คล้าย tab รายละเอียดคำขอเป็นนักเขียน) — แต่ละอันมี
// pagination/filter ของตัวเอง แยกเป็น query คนละก้อนไม่ยัดรวมกับ getUserDetail() (จะช้าถ้าดึงทุก
// อย่างมาพร้อมกันตั้งแต่เปิดหน้าต่างทั้งที่ user อาจไม่ได้กดดูทุกแท็บ)
// =============================================================

// ---- กราฟใช้จ่ายตามระยะเวลา — รวมเป็นรายวันย้อนหลัง N วัน (level 8 เรียกไม่ได้ เช็คที่ route) ----
export async function getUserSpendingSeries(userUuid: string, days: number) {
  const user = await db.selectFrom('users').select('id').where('uuid', '=', userUuid).executeTakeFirst()
  if (!user) throw new Error('USER_NOT_FOUND')

  const rows = await db
    .selectFrom('coin_ledger')
    .select([
      sql<string>`date_trunc('day', created_at)`.as('day'),
      ({ fn }) => fn.sum<string>('delta').as('s'),
    ])
    .where('user_id', '=', user.id)
    .where('reason', '=', 'purchase')
    .where('created_at', '>=', new Date(Date.now() - days * 24 * 60 * 60 * 1000))
    .groupBy(sql`date_trunc('day', created_at)`)
    .orderBy(sql`date_trunc('day', created_at)`, 'asc')
    .execute()

  // delta ฝั่งซื้อเป็นค่าลบเสมอ — กลับเครื่องหมายให้เป็น "ใช้ไปเท่าไหร่ต่อวัน"
  return rows.map((r) => ({ date: r.day, amount: String(-BigInt(r.s)) }))
}

// ---- Login records — จาก login_history (migration 026) ----
export async function getUserLoginRecords(userUuid: string, page: number, limit: number) {
  const user = await db.selectFrom('users').select('id').where('uuid', '=', userUuid).executeTakeFirst()
  if (!user) throw new Error('USER_NOT_FOUND')
  const offset = (page - 1) * limit

  const rows = await db
    .selectFrom('login_history')
    .select(['id', 'success', 'ip_address', 'user_agent', 'created_at'])
    .where('user_id', '=', user.id)
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  const countRow = await db
    .selectFrom('login_history')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('user_id', '=', user.id)
    .executeTakeFirstOrThrow()
  const total = Number(countRow.total)

  return {
    data: rows.map((r) => ({
      id: String(r.id),
      success: r.success,
      ip_address: r.ip_address,
      user_agent: r.user_agent,
      created_at: r.created_at,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

// ---- Topup records — maxDays มาจาก route (level 8 = 14, level >= 9 = undefined = ไม่จำกัด) ----
export async function getUserTopupRecords(
  userUuid: string,
  page: number,
  limit: number,
  maxDays?: number,
) {
  const user = await db.selectFrom('users').select('id').where('uuid', '=', userUuid).executeTakeFirst()
  if (!user) throw new Error('USER_NOT_FOUND')
  const offset = (page - 1) * limit

  let query = db
    .selectFrom('topup_transactions')
    .select(['id', 'transaction_id', 'payment_method', 'amount_paid', 'coins_added', 'status', 'created_at'])
    .where('user_id', '=', user.id)

  if (maxDays !== undefined) {
    query = query.where('created_at', '>=', new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000))
  }

  const rows = await query.orderBy('created_at', 'desc').limit(limit).offset(offset).execute()

  let countQuery = db
    .selectFrom('topup_transactions')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('user_id', '=', user.id)
  if (maxDays !== undefined) {
    countQuery = countQuery.where('created_at', '>=', new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000))
  }
  const countRow = await countQuery.executeTakeFirstOrThrow()
  const total = Number(countRow.total)

  return {
    data: rows.map((r) => ({
      id: String(r.id),
      transaction_id: r.transaction_id,
      payment_method: r.payment_method,
      amount_paid: r.amount_paid,
      coins_added: String(r.coins_added),
      status: r.status,
      created_at: r.created_at,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    capped_to_days: maxDays ?? null,
  }
}

// ---- Comment records ----
export async function getUserCommentRecords(userUuid: string, page: number, limit: number) {
  const user = await db.selectFrom('users').select('id').where('uuid', '=', userUuid).executeTakeFirst()
  if (!user) throw new Error('USER_NOT_FOUND')
  const offset = (page - 1) * limit

  const rows = await db
    .selectFrom('work_comments as c')
    .innerJoin('works as w', 'w.p_id', 'c.work_id')
    .select([
      'c.id', 'c.content', 'c.likes_count', 'c.status', 'c.created_at',
      'w.uuid as work_uuid', 'w.title as work_title',
    ])
    .where('c.user_id', '=', user.id)
    .orderBy('c.created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  const countRow = await db
    .selectFrom('work_comments')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('user_id', '=', user.id)
    .executeTakeFirstOrThrow()
  const total = Number(countRow.total)

  return {
    data: rows.map((r) => ({
      id: String(r.id),
      content: r.content,
      likes_count: r.likes_count,
      status: r.status,
      created_at: r.created_at,
      work: { uuid: r.work_uuid, title: r.work_title },
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

// ---- Reading records — งานที่อ่าน (work_ep_views) พร้อม flag ว่าตอนนั้นซื้อหรือเปล่า (ep_shop)
// รวมเข้าด้วยกันตามที่ user ขอ ("reading record รวมเข้ากับการดูเลยว่าซื้อเรื่องไหนแล้วบ้าง") —
// filter ได้ด้วยชื่อเรื่อง ----
export async function getUserReadingRecords(
  userUuid: string,
  page: number,
  limit: number,
  workSearch?: string,
) {
  const user = await db.selectFrom('users').select('id').where('uuid', '=', userUuid).executeTakeFirst()
  if (!user) throw new Error('USER_NOT_FOUND')
  const offset = (page - 1) * limit

  let query = db
    .selectFrom('work_ep_views as v')
    .innerJoin('works as w', 'w.p_id', 'v.p_id')
    .leftJoin('ep_shop as s', (join) =>
      join.onRef('s.p_id', '=', 'v.p_id').onRef('s.ep_no', '=', 'v.ep_no').onRef('s.user_id', '=', 'v.user_id'),
    )
    .select([
      'v.id', 'v.ep_no', 'v.created_at',
      'w.uuid as work_uuid', 'w.title as work_title',
      's.id as purchase_id', 's.price as purchase_price',
    ])
    .where('v.user_id', '=', user.id)

  if (workSearch) query = query.where('w.title', 'ilike', `%${workSearch}%`)

  const rows = await query.orderBy('v.created_at', 'desc').limit(limit).offset(offset).execute()

  let countQuery = db
    .selectFrom('work_ep_views as v')
    .innerJoin('works as w', 'w.p_id', 'v.p_id')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('v.user_id', '=', user.id)
  if (workSearch) countQuery = countQuery.where('w.title', 'ilike', `%${workSearch}%`)
  const countRow = await countQuery.executeTakeFirstOrThrow()
  const total = Number(countRow.total)

  return {
    data: rows.map((r) => ({
      id: String(r.id),
      ep_no: r.ep_no,
      created_at: r.created_at,
      work: { uuid: r.work_uuid, title: r.work_title },
      is_purchased: r.purchase_id !== null,
      purchase_price: r.purchase_price,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

// 2026-07-30 มติเรื่องเลเวล: 1=นักอ่านทั่วไป, 6=นักเขียน, 8=แอดมินย่อย, 9=แอดมินรอง, 10=shareholder
// (2-5, 7 เว้นว่างไว้เผื่ออนาคต) — level 8/9 จัดการได้แค่โซนนักอ่าน/นักเขียน (1 ↔ 6) เท่านั้น
// จะแตะระดับแอดมิน (8/9/10) ตรงๆ ไม่ได้เด็ดขาด ต้องผ่าน promote_level_8 request (ดู
// createAdminActionRequest ด้านล่าง) หรือเป็น level 10 เท่านั้นถึงจะตั้งได้ทุกระดับ
// 2026-08-10: เพิ่ม 7 เข้ามา — "นักเขียนของเว็บ" (บัญชีผีที่บริษัทคุมเอง ใช้ปั้นเนื้อหา/ย้ายข้อมูล
// ก้อนใหญ่) ยังอยู่ในโซนนักอ่าน/นักเขียนเดิม (ไม่ใช่โซนแอดมิน 8/9/10) เลยให้ level 8/9 ตั้งตรงได้
// เหมือน 6/1 ไม่ต้องผ่าน promote_level_8 request (นั่นมีไว้กันเฉพาะระดับแอดมินจริงเท่านั้น)
const ADMIN_MANAGED_LEVELS = [6, 1, 7] as const

// 2026-08-05 บั๊กจริงที่ user เจอเอง: level 9 (devtest) สั่งระงับ level 10 ได้ — ฟังก์ชัน
// moderation ทุกตัว (ban/suspend/perma-delete/setUserLevel) เช็คแค่ USER_NOT_FOUND +
// CANNOT_EDIT_SELF ไม่เคยเช็คว่า target level สูงกว่า/เท่ากับผู้สั่งเองหรือเปล่าเลย — เพิ่ม guard
// กลางตัวนี้ ใช้ร่วมกันทุกจุด: ห้ามสั่งงานกับใครก็ตามที่ level >= ของตัวเอง (ทั้งเท่ากันและสูงกว่า)
// กันทั้งแอดมิน peer สั่งกันเอง และแอดมินระดับต่ำไปแตะระดับสูงกว่า
export function assertCanModerate(adminLevel: number, targetLevel: number) {
  if (targetLevel >= adminLevel) throw new Error('CANNOT_MODERATE_HIGHER_LEVEL')
}

export async function setUserLevel(
  adminId: bigint,
  adminLevel: number,
  userUuid: string,
  level: number,
) {
  const user = await db
    .selectFrom('users')
    .select(['id', 'level'])
    .where('uuid', '=', userUuid)
    .executeTakeFirst()

  if (!user)                       throw new Error('USER_NOT_FOUND')
  if (BigInt(user.id) === adminId) throw new Error('CANNOT_EDIT_SELF')
  assertCanModerate(adminLevel, user.level)

  if (adminLevel < 10 && !(ADMIN_MANAGED_LEVELS as readonly number[]).includes(level)) {
    throw new Error('LEVEL_NOT_ALLOWED')
  }

  await db
    .updateTable('users')
    .set({ level, updated_at: new Date() })
    .where('id', '=', user.id)
    .execute()

  await writeAuditLog(adminId, 'SET_LEVEL', 'user', String(user.id), `level → ${level}`)
}

export async function banUser(adminId: bigint, adminLevel: number, userUuid: string, reason: string) {
  const user = await db
    .selectFrom('users')
    .select(['id', 'level'])
    .where('uuid', '=', userUuid)
    .executeTakeFirst()

  if (!user)                       throw new Error('USER_NOT_FOUND')
  if (BigInt(user.id) === adminId) throw new Error('CANNOT_BAN_SELF')
  assertCanModerate(adminLevel, user.level)

  const existing = await db
    .selectFrom('user_bans')
    .select('id')
    .where('user_id', '=', user.id)
    .where('unbanned_at', 'is', null)
    .executeTakeFirst()

  if (existing) throw new Error('ALREADY_BANNED')

  await db
    .insertInto('user_bans')
    .values({
      user_id:   user.id,
      banned_by: adminId,
      reason:    reason,
    })
    .execute()

  await writeAuditLog(adminId, 'BAN_USER', 'user', String(user.id), reason)
}

export async function unbanUser(adminId: bigint, userUuid: string) {
  const user = await db
    .selectFrom('users')
    .select('id')
    .where('uuid', '=', userUuid)
    .executeTakeFirst()

  if (!user) throw new Error('USER_NOT_FOUND')

  const ban = await db
    .selectFrom('user_bans')
    .select('id')
    .where('user_id', '=', user.id)
    .where('unbanned_at', 'is', null)
    .executeTakeFirst()

  if (!ban) throw new Error('NOT_BANNED')

  await db
    .updateTable('user_bans')
    .set({ unbanned_at: new Date() })
    .where('id', '=', ban.id)
    .execute()

  await writeAuditLog(adminId, 'UNBAN_USER', 'user', String(user.id))
}

// =============================================================
// Suspensions (migration 027) — "ระงับการเคลื่อนไหว" / "ระงับการใช้จ่าย+เติมเงิน"
// คนละเรื่องกับแบน — ซ้อนกับแบน/กันเองได้พร้อมกันตามที่ user ยืนยัน (2026-07-30) ไม่ใช่สถานะ
// เดียวที่แทนที่กัน — เก็บเป็นตารางแยกแบบเดียวกับ user_bans (lifted_at null = active)
// =============================================================

export async function suspendActivity(adminId: bigint, adminLevel: number, userUuid: string, reason: string) {
  const user = await db
    .selectFrom('users')
    .select(['id', 'level'])
    .where('uuid', '=', userUuid)
    .executeTakeFirst()

  if (!user)                       throw new Error('USER_NOT_FOUND')
  if (BigInt(user.id) === adminId) throw new Error('CANNOT_EDIT_SELF')
  assertCanModerate(adminLevel, user.level)

  const existing = await db
    .selectFrom('user_activity_suspensions')
    .select('id')
    .where('user_id', '=', user.id)
    .where('lifted_at', 'is', null)
    .executeTakeFirst()

  if (existing) throw new Error('ALREADY_ACTIVITY_SUSPENDED')

  await db
    .insertInto('user_activity_suspensions')
    .values({ user_id: user.id, suspended_by: adminId, reason })
    .execute()

  await writeAuditLog(adminId, 'SUSPEND_ACTIVITY', 'user', String(user.id), reason)
}

export async function liftActivitySuspension(adminId: bigint, userUuid: string) {
  const user = await db
    .selectFrom('users')
    .select('id')
    .where('uuid', '=', userUuid)
    .executeTakeFirst()

  if (!user) throw new Error('USER_NOT_FOUND')

  const susp = await db
    .selectFrom('user_activity_suspensions')
    .select('id')
    .where('user_id', '=', user.id)
    .where('lifted_at', 'is', null)
    .executeTakeFirst()

  if (!susp) throw new Error('NOT_ACTIVITY_SUSPENDED')

  await db
    .updateTable('user_activity_suspensions')
    .set({ lifted_at: new Date() })
    .where('id', '=', susp.id)
    .execute()

  await writeAuditLog(adminId, 'LIFT_ACTIVITY_SUSPENSION', 'user', String(user.id))
}

export async function suspendSpending(adminId: bigint, adminLevel: number, userUuid: string, reason: string) {
  const user = await db
    .selectFrom('users')
    .select(['id', 'level'])
    .where('uuid', '=', userUuid)
    .executeTakeFirst()

  if (!user)                       throw new Error('USER_NOT_FOUND')
  if (BigInt(user.id) === adminId) throw new Error('CANNOT_EDIT_SELF')
  assertCanModerate(adminLevel, user.level)

  const existing = await db
    .selectFrom('user_spend_suspensions')
    .select('id')
    .where('user_id', '=', user.id)
    .where('lifted_at', 'is', null)
    .executeTakeFirst()

  if (existing) throw new Error('ALREADY_SPEND_SUSPENDED')

  await db
    .insertInto('user_spend_suspensions')
    .values({ user_id: user.id, suspended_by: adminId, reason })
    .execute()

  await writeAuditLog(adminId, 'SUSPEND_SPENDING', 'user', String(user.id), reason)
}

export async function liftSpendSuspension(adminId: bigint, userUuid: string) {
  const user = await db
    .selectFrom('users')
    .select('id')
    .where('uuid', '=', userUuid)
    .executeTakeFirst()

  if (!user) throw new Error('USER_NOT_FOUND')

  const susp = await db
    .selectFrom('user_spend_suspensions')
    .select('id')
    .where('user_id', '=', user.id)
    .where('lifted_at', 'is', null)
    .executeTakeFirst()

  if (!susp) throw new Error('NOT_SPEND_SUSPENDED')

  await db
    .updateTable('user_spend_suspensions')
    .set({ lifted_at: new Date() })
    .where('id', '=', susp.id)
    .execute()

  await writeAuditLog(adminId, 'LIFT_SPEND_SUSPENSION', 'user', String(user.id))
}

// =============================================================
// ลบบัญชีถาวร (migration 027) — level 10 เท่านั้น (เช็คที่ route)
// ⚠️ anonymize ไม่ใช่ DELETE row จริง — ดู comment เหตุผลใน migration 027_admin_user_management.sql
// เคลียร์ email/username/รูป/social ทิ้ง (กันชนกับ unique constraint ถ้ามีคนสมัครซ้ำในอนาคต ต่อ
// ท้าย uuid สั้นๆ ไว้กับ placeholder) ตั้ง password_hash เป็นค่าที่ไม่มีทาง login เข้าได้ (เคลียร์
// เป็นค่าว่างไม่ได้ — argon2 hash ว่างอาจ verify ผ่านถ้า input ว่างด้วย จึงสุ่ม token ทิ้งไปแทน)
// ไม่แตะ comments/works/coin_ledger ที่มีอยู่แล้ว (คงไว้เพื่อความสมบูรณ์ของข้อมูล ตามหลัก
// anonymize-not-delete) — งานที่เผยแพร่อยู่ของนักเขียนที่โดนลบจะยังโชว์ผู้แต่งเป็น "ผู้ใช้ที่ถูกลบ"
// =============================================================

export async function permaDeleteUser(adminId: bigint, adminLevel: number, userUuid: string, reason: string) {
  const user = await db
    .selectFrom('users')
    .select(['id', 'level', 'deleted_at'])
    .where('uuid', '=', userUuid)
    .executeTakeFirst()

  if (!user)                       throw new Error('USER_NOT_FOUND')
  if (BigInt(user.id) === adminId) throw new Error('CANNOT_EDIT_SELF')
  if (user.deleted_at)             throw new Error('ALREADY_DELETED')
  assertCanModerate(adminLevel, user.level)

  const anonToken = crypto.randomUUID()

  await db
    .updateTable('users')
    .set({
      display_name:  'ผู้ใช้ที่ถูกลบ',
      email:         `deleted-${anonToken}@deleted.local`,
      u_name:        `deleted_${anonToken.slice(0, 8)}`,
      password_hash: `deleted:${anonToken}`,  // ไม่มีทาง argon2 verify ผ่านค่านี้ได้เลย
      user_img:      null,
      bio:           null,
      social_media:  null,
      google_id:     null,
      google_token:  null,
      deleted_at:      new Date(),
      deleted_by:      adminId,
      deletion_reason: reason,
      updated_at:      new Date(),
    })
    .where('id', '=', user.id)
    .execute()

  await writeAuditLog(adminId, 'PERMA_DELETE_USER', 'user', String(user.id), reason)
}

// =============================================================
// Level-8 Flag System (migration 027) — มติ 2026-07-30
//
// level 8 กดเครื่องมือ 4 อย่าง (suspend_activity/suspend_spending/ban/delete) ไม่ได้เลยตรงๆ
// ได้แต่ "Flag" — ต้องมี level 8 คนอื่น flag เป้าหมาย+action เดียวกันในช่วงเวลาใกล้กัน
// (flag_window_hours) ครบจำนวนขั้นต่ำ (flag_threshold_count, level 10 ตั้งได้ผ่าน
// PATCH /admin/settings) ถึงจะ auto-execute ให้เอง (เปิด/ปิดได้ผ่าน flag_auto_execute_enabled)
// — level 9 ขึ้นไปเห็น flag ทั้งหมดและ execute/dismiss เองได้ทันทีไม่ต้องรอครบเกณฑ์
// =============================================================

type FlagActionType = 'suspend_activity' | 'suspend_spending' | 'ban' | 'delete'

const FLAG_EXECUTORS: Record<FlagActionType, (adminId: bigint, adminLevel: number, userUuid: string, reason: string) => Promise<void>> = {
  suspend_activity: suspendActivity,
  suspend_spending: suspendSpending,
  ban: banUser,
  delete: permaDeleteUser,
}

// error ที่แปลว่า "ทำไปแล้ว/สถานะนี้อยู่แล้ว" — เจอได้ถ้ามี level 9 มา execute มือไปก่อนหน้า
// auto-execute จะทำงานพอดี ถือว่า flag บรรลุจุดประสงค์แล้วเหมือนกัน ไม่ใช่ error จริง
const ALREADY_DONE_ERRORS = new Set([
  'ALREADY_ACTIVITY_SUSPENDED', 'ALREADY_SPEND_SUSPENDED', 'ALREADY_BANNED', 'ALREADY_DELETED',
])

export async function createUserFlag(params: {
  flaggedBy: bigint
  targetUserUuid: string
  actionType: FlagActionType
  reason: string
}) {
  const { flaggedBy, targetUserUuid, actionType, reason } = params

  const target = await db
    .selectFrom('users')
    .select(['id', 'level'])
    .where('uuid', '=', targetUserUuid)
    .executeTakeFirst()

  if (!target)                        throw new Error('USER_NOT_FOUND')
  if (BigInt(target.id) === flaggedBy) throw new Error('CANNOT_EDIT_SELF')
  // Flag มีไว้ให้ level 8 จัดการ "ผู้ใช้ทั่วไป" (นักอ่าน/นักเขียน) เท่านั้น — ไม่ใช่เครื่องมือ
  // สำหรับแอดมินไปยุ่งกับแอดมินคนอื่น (2026-08-05 กันไม่ให้ auto-execute หลุดไปโดน level สูงกว่า
  // ด้วย เพราะถ้าปล่อยให้ flag สร้างได้ พอครบเกณฑ์ auto-execute จะไปชน assertCanModerate()
  // แล้ว error กลางทาง — กันตั้งแต่ตอนสร้าง flag เลยดีกว่า)
  if (target.level >= 8) throw new Error('CANNOT_FLAG_ADMIN')

  const existing = await db
    .selectFrom('admin_user_flags')
    .select('id')
    .where('target_user_id', '=', target.id)
    .where('action_type', '=', actionType)
    .where('flagged_by', '=', flaggedBy)
    .where('status', '=', 'pending')
    .executeTakeFirst()

  if (existing) throw new Error('FLAG_ALREADY_PENDING')

  const row = await db
    .insertInto('admin_user_flags')
    .values({ target_user_id: target.id, action_type: actionType, flagged_by: flaggedBy, reason })
    .returning(['id'])
    .executeTakeFirstOrThrow()

  await writeAuditLog(flaggedBy, `FLAG_${actionType.toUpperCase()}`, 'user', String(target.id), reason)

  const settings = await getWebSettings()
  const autoExecuteEnabled = settings.flag_auto_execute_enabled !== 'false' // default เปิด ถ้ายังไม่มี key
  const threshold = Number(settings.flag_threshold_count ?? 3)
  const windowHours = Number(settings.flag_window_hours ?? 48)

  if (!autoExecuteEnabled) return { id: String(row.id), auto_executed: false }

  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000)

  const pendingFlags = await db
    .selectFrom('admin_user_flags')
    .select(['id', 'flagged_by'])
    .where('target_user_id', '=', target.id)
    .where('action_type', '=', actionType)
    .where('status', '=', 'pending')
    .where('created_at', '>=', windowStart)
    .execute()

  const distinctFlaggers = new Set(pendingFlags.map((f) => String(f.flagged_by)))
  if (distinctFlaggers.size < threshold) return { id: String(row.id), auto_executed: false }

  // ครบเกณฑ์ — auto-execute โดยใช้ผู้ flag ล่าสุด (คนที่เพิ่งทำให้ครบ) เป็นผู้ลงชื่อใน audit log
  // ของ action จริง (ไม่มี "แอดมิน" คนเดียวที่กดเองตรงๆ ในเคส auto-execute)
  try {
    // flaggedBy การันตีเป็น level 8 เสมอ (route เดียวที่เรียก createUserFlag ล็อกไว้แค่ level 8) —
    // ส่ง 8 ตรงๆ ให้ assertCanModerate() ใน executor เช็คได้ (ไม่กระทบอะไรเพิ่มเพราะ target
    // ถูกกันไว้ตั้งแต่ตอนสร้าง flag แล้วว่าต้อง level < 8 เท่านั้น)
    await FLAG_EXECUTORS[actionType](
      flaggedBy,
      8,
      targetUserUuid,
      `Auto-executed จาก consensus ${distinctFlaggers.size} คน (เกณฑ์ ${threshold} ภายใน ${windowHours} ชม.)`,
    )
  } catch (err: any) {
    // มี level 9 execute มือไปพอดีก่อนหน้านี้เสี้ยววินาที — ถือว่า flag บรรลุผลแล้วเหมือนกัน
    if (!ALREADY_DONE_ERRORS.has(err.message)) throw err
  }

  await db
    .updateTable('admin_user_flags')
    .set({ status: 'auto_executed', reviewed_at: new Date() })
    .where('id', 'in', pendingFlags.map((f) => f.id))
    .execute()

  return { id: String(row.id), auto_executed: true }
}

export async function listUserFlags(params: {
  status?: 'pending' | 'auto_executed' | 'executed' | 'dismissed'
  page: number
  limit: number
}) {
  const { status, page, limit } = params
  const offset = (page - 1) * limit

  let query = db
    .selectFrom('admin_user_flags as f')
    .innerJoin('users as target', 'target.id', 'f.target_user_id')
    .innerJoin('users as flagger', 'flagger.id', 'f.flagged_by')
    .leftJoin('users as reviewer', 'reviewer.id', 'f.reviewed_by')
    .select([
      'f.id', 'f.target_user_id', 'f.action_type', 'f.reason', 'f.status',
      'f.review_note', 'f.created_at', 'f.reviewed_at',
      'target.uuid as target_uuid', 'target.display_name as target_display_name',
      'target.u_name as target_u_name',
      'flagger.uuid as flagger_uuid', 'flagger.display_name as flagger_display_name',
      'reviewer.display_name as reviewer_display_name',
    ])

  if (status) query = query.where('f.status', '=', status)

  const rows = await query.orderBy('f.created_at', 'desc').limit(limit).offset(offset).execute()

  let countQuery = db.selectFrom('admin_user_flags').select(({ fn }) => fn.countAll<string>().as('total'))
  if (status) countQuery = countQuery.where('status', '=', status)
  const countRow = await countQuery.executeTakeFirstOrThrow()
  const total = Number(countRow.total)

  // นับจำนวนคน flag ไม่ซ้ำต่อ (target, action_type) ที่ยัง pending — ให้ level 9+ เห็นว่าใกล้ครบ
  // เกณฑ์แค่ไหนโดยไม่ต้องนับเอง
  const pendingCountRows = await db
    .selectFrom('admin_user_flags')
    .select(['target_user_id', 'action_type', ({ fn }) => fn.count<string>('flagged_by').distinct().as('c')])
    .where('status', '=', 'pending')
    .groupBy(['target_user_id', 'action_type'])
    .execute()
  const countMap = new Map(
    pendingCountRows.map((r) => [`${r.target_user_id}:${r.action_type}`, Number(r.c)]),
  )

  const settings = await getWebSettings()
  const threshold = Number(settings.flag_threshold_count ?? 3)

  return {
    data: rows.map((r) => ({
      id: String(r.id),
      action_type: r.action_type,
      reason: r.reason,
      status: r.status,
      review_note: r.review_note,
      created_at: r.created_at,
      reviewed_at: r.reviewed_at,
      target: { uuid: r.target_uuid, display_name: r.target_display_name, u_name: r.target_u_name },
      flagged_by: { uuid: r.flagger_uuid, display_name: r.flagger_display_name },
      reviewed_by_name: r.reviewer_display_name,
      pending_count: countMap.get(`${r.target_user_id}:${r.action_type}`) ?? 0,
      threshold,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

export async function reviewUserFlag(
  reviewerId: bigint,
  reviewerLevel: number,
  flagId: bigint,
  action: 'execute' | 'dismiss',
  note?: string,
) {
  const flag = await db
    .selectFrom('admin_user_flags')
    .selectAll()
    .where('id', '=', flagId)
    .executeTakeFirst()

  if (!flag)                      throw new Error('FLAG_NOT_FOUND')
  if (flag.status !== 'pending')  throw new Error('FLAG_NOT_PENDING')

  // ลบบัญชีถาวรเป็นสิทธิ์ level 10 เท่านั้นเสมอ (มติ 2026-07-30 — "level 9 ... ถึงขั้นลบบัญชี
  // (Perma Delete) จะห้ามทำ") ต่างจาก action อื่นที่ level >= 9 execute ได้ปกติ
  if (action === 'execute' && flag.action_type === 'delete' && reviewerLevel < 10) {
    throw new Error('INSUFFICIENT_LEVEL')
  }

  const target = await db
    .selectFrom('users')
    .select('uuid')
    .where('id', '=', flag.target_user_id)
    .executeTakeFirstOrThrow()

  if (action === 'execute') {
    try {
      await FLAG_EXECUTORS[flag.action_type](reviewerId, reviewerLevel, target.uuid, note || flag.reason)
    } catch (err: any) {
      if (!ALREADY_DONE_ERRORS.has(err.message)) throw err
    }
  }

  // ปิด flag นี้ + flag อื่นที่ pending บน (target, action_type) เดียวกันทั้งหมดพร้อมกัน กัน ticket
  // ซ้ำค้างให้คนอื่นมาเจอทีหลังทั้งที่ตัดสินใจไปแล้ว
  await db
    .updateTable('admin_user_flags')
    .set({
      status: action === 'execute' ? 'executed' : 'dismissed',
      reviewed_by: reviewerId,
      review_note: note ?? null,
      reviewed_at: new Date(),
    })
    .where('target_user_id', '=', flag.target_user_id)
    .where('action_type', '=', flag.action_type)
    .where('status', '=', 'pending')
    .execute()

  await writeAuditLog(reviewerId, `${action.toUpperCase()}_USER_FLAG`, 'admin_user_flags', String(flagId), note)
}

// =============================================================
// Admin Action Requests — 2 ระบบอนุมัติ (มติ 2026-07-30)
//   ban_user         — level 8 ส่งคำขอ, level >= 9 อนุมัติ (level 9/10 แบนตรงได้เลยไม่ต้องขอ)
//   promote_level_8  — level 9 ส่งคำขอ, level >= 10 อนุมัติ (level 10 ตั้งเองได้เลยไม่ต้องขอ)
// =============================================================

const REQUEST_MIN_APPROVER_LEVEL: Record<'ban_user' | 'promote_level_8', number> = {
  ban_user: 9,
  promote_level_8: 10,
}

export async function createAdminActionRequest(params: {
  requestType: 'ban_user' | 'promote_level_8'
  requestedBy: bigint
  targetUserUuid: string
  reason: string
}) {
  const { requestType, requestedBy, targetUserUuid, reason } = params

  const target = await db
    .selectFrom('users')
    .select('id')
    .where('uuid', '=', targetUserUuid)
    .executeTakeFirst()

  if (!target)                          throw new Error('USER_NOT_FOUND')
  if (BigInt(target.id) === requestedBy) throw new Error('CANNOT_EDIT_SELF')

  const existing = await db
    .selectFrom('admin_action_requests')
    .select('id')
    .where('request_type', '=', requestType)
    .where('target_user_id', '=', target.id)
    .where('status', '=', 'pending')
    .executeTakeFirst()

  if (existing) throw new Error('REQUEST_ALREADY_PENDING')

  const row = await db
    .insertInto('admin_action_requests')
    .values({
      request_type: requestType,
      requested_by: requestedBy,
      target_user_id: target.id,
      reason,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow()

  await writeAuditLog(requestedBy, `REQUEST_${requestType.toUpperCase()}`, 'user', String(target.id), reason)

  return { id: String(row.id) }
}

export async function listAdminActionRequests(params: {
  requestType: 'ban_user' | 'promote_level_8'
  status?: 'pending' | 'approved' | 'rejected'
  page: number
  limit: number
}) {
  const { requestType, status, page, limit } = params
  const offset = (page - 1) * limit

  let query = db
    .selectFrom('admin_action_requests as r')
    .innerJoin('users as target', 'target.id', 'r.target_user_id')
    .innerJoin('users as requester', 'requester.id', 'r.requested_by')
    .leftJoin('users as reviewer', 'reviewer.id', 'r.reviewed_by')
    .select([
      'r.id', 'r.request_type', 'r.reason', 'r.status',
      'r.review_note', 'r.created_at', 'r.reviewed_at',
      'target.uuid as target_uuid', 'target.display_name as target_display_name',
      'target.u_name as target_u_name', 'target.level as target_level',
      'requester.uuid as requester_uuid', 'requester.display_name as requester_display_name',
      'reviewer.display_name as reviewer_display_name',
    ])
    .where('r.request_type', '=', requestType)

  if (status) query = query.where('r.status', '=', status)

  const rows = await query
    .orderBy('r.created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  let countQuery = db
    .selectFrom('admin_action_requests')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('request_type', '=', requestType)

  if (status) countQuery = countQuery.where('status', '=', status)

  const countRow = await countQuery.executeTakeFirstOrThrow()
  const total = Number(countRow.total)

  return {
    data: rows.map((r) => ({
      id: String(r.id),
      request_type: r.request_type,
      reason: r.reason,
      status: r.status,
      review_note: r.review_note,
      created_at: r.created_at,
      reviewed_at: r.reviewed_at,
      target: {
        uuid: r.target_uuid,
        display_name: r.target_display_name,
        u_name: r.target_u_name,
        level: r.target_level,
      },
      requested_by: { uuid: r.requester_uuid, display_name: r.requester_display_name },
      reviewed_by_name: r.reviewer_display_name,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

async function getPendingRequestOrThrow(requestId: bigint) {
  const request = await db
    .selectFrom('admin_action_requests')
    .selectAll()
    .where('id', '=', requestId)
    .executeTakeFirst()

  if (!request) throw new Error('REQUEST_NOT_FOUND')
  if (request.status !== 'pending') throw new Error('REQUEST_NOT_PENDING')

  return request
}

export async function approveAdminActionRequest(
  reviewerId: bigint,
  reviewerLevel: number,
  requestId: bigint,
  note?: string,
) {
  const request = await getPendingRequestOrThrow(requestId)

  const minLevel = REQUEST_MIN_APPROVER_LEVEL[request.request_type]
  if (reviewerLevel < minLevel) throw new Error('INSUFFICIENT_LEVEL')

  const target = await db
    .selectFrom('users')
    .select('uuid')
    .where('id', '=', request.target_user_id)
    .executeTakeFirstOrThrow()
  const requester = await db
    .selectFrom('users')
    .select(['u_name', 'display_name'])
    .where('id', '=', request.requested_by)
    .executeTakeFirstOrThrow()

  if (request.request_type === 'ban_user') {
    await banUser(reviewerId, reviewerLevel, target.uuid, request.reason)
  } else {
    await setUserLevel(reviewerId, reviewerLevel, target.uuid, 8)
  }

  await db
    .updateTable('admin_action_requests')
    .set({ status: 'approved', reviewed_by: reviewerId, review_note: note ?? null, reviewed_at: new Date() })
    .where('id', '=', requestId)
    .execute()

  // เขียน log แยกต่างหากจาก BAN_USER/SET_LEVEL ที่ banUser()/setUserLevel() เขียนไปแล้วด้านบน —
  // อันนั้นบันทึกแค่ "ใครทำ" (reviewer) อันนี้เก็บบริบทเพิ่มว่า "อนุมัติคำขอจากใคร" (2026-08-04
  // user ขอให้หน้า "ประวัติ" ต้องดูออกว่า "อนุมัติอะไรจากใคร" ได้ ไม่ใช่แค่ใครทำ)
  await writeAuditLog(
    reviewerId,
    'APPROVE_ADMIN_REQUEST',
    'admin_action_requests',
    String(requestId),
    `อนุมัติคำขอ "${request.request_type}" ที่ @${requester.u_name} (${requester.display_name}) เป็นคนขอมา`,
  )
}

export async function rejectAdminActionRequest(
  reviewerId: bigint,
  reviewerLevel: number,
  requestId: bigint,
  note: string,
) {
  const request = await getPendingRequestOrThrow(requestId)

  const minLevel = REQUEST_MIN_APPROVER_LEVEL[request.request_type]
  if (reviewerLevel < minLevel) throw new Error('INSUFFICIENT_LEVEL')

  const requester = await db
    .selectFrom('users')
    .select(['u_name', 'display_name'])
    .where('id', '=', request.requested_by)
    .executeTakeFirstOrThrow()

  await db
    .updateTable('admin_action_requests')
    .set({ status: 'rejected', reviewed_by: reviewerId, review_note: note, reviewed_at: new Date() })
    .where('id', '=', requestId)
    .execute()

  await writeAuditLog(
    reviewerId,
    'REJECT_ADMIN_REQUEST',
    'admin_action_requests',
    String(requestId),
    `ปฏิเสธคำขอ "${request.request_type}" ที่ @${requester.u_name} (${requester.display_name}) เป็นคนขอมา — เหตุผล: ${note}`,
  )
}

// =============================================================
// Writer Application Review (user_detail) — level >= 8 อนุมัติ/ปฏิเสธได้เลย ไม่ต้องขอสิทธิ์
// เพิ่มขึ้น (นี่คือ "อนุมัติคน" ที่เป็นหน้าที่หลักของ level 8 ตามมติ 2026-07-30)
// =============================================================

export async function listWriterApplications(params: {
  status?: 'pending' | 'approve' | 'rejected'
  application_type?: 'new_writer' | 'edit'
  page: number
  limit: number
}) {
  const { status, application_type, page, limit } = params
  const offset = (page - 1) * limit

  let query = db
    .selectFrom('user_detail as d')
    .innerJoin('users as u', 'u.id', 'd.user_id')
    .select([
      'd.id', 'd.user_prefix', 'd.first_name', 'd.last_name', 'd.national_id',
      'd.id_address', 'd.id_province', 'd.id_district', 'd.id_subdistrict', 'd.id_postal_code',
      'd.current_address', 'd.current_province', 'd.current_district', 'd.current_subdistrict', 'd.current_postal_code',
      'd.user_phone', 'd.bank_name', 'd.bank_branch', 'd.bank_number',
      'd.status', 'd.application_type', 'd.reject_reason', 'd.created_at', 'd.updated_at',
      'u.uuid as user_uuid', 'u.display_name', 'u.u_name', 'u.email', 'u.level',
    ])

  if (status) query = query.where('d.status', '=', status)
  if (application_type) query = query.where('d.application_type', '=', application_type)

  const rows = await query
    .orderBy('d.created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  let countQuery = db.selectFrom('user_detail').select(({ fn }) => fn.countAll<string>().as('total'))
  if (status) countQuery = countQuery.where('status', '=', status)
  if (application_type) countQuery = countQuery.where('application_type', '=', application_type)
  const countRow = await countQuery.executeTakeFirstOrThrow()
  const total = Number(countRow.total)

  return {
    data: rows.map((r) => ({
      id: String(r.id),
      user: { uuid: r.user_uuid, display_name: r.display_name, u_name: r.u_name, email: r.email, level: r.level },
      user_prefix: r.user_prefix,
      first_name: r.first_name,
      last_name: r.last_name,
      national_id: r.national_id,
      id_address: r.id_address,
      id_province: r.id_province,
      id_district: r.id_district,
      id_subdistrict: r.id_subdistrict,
      id_postal_code: r.id_postal_code,
      current_address: r.current_address,
      current_province: r.current_province,
      current_district: r.current_district,
      current_subdistrict: r.current_subdistrict,
      current_postal_code: r.current_postal_code,
      user_phone: r.user_phone,
      bank_name: r.bank_name,
      bank_branch: r.bank_branch,
      bank_number: r.bank_number,
      status: r.status,
      application_type: r.application_type,
      reject_reason: r.reject_reason,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

export async function approveWriterApplication(adminId: bigint, adminLevel: number, applicationId: bigint) {
  const app = await db
    .selectFrom('user_detail as d')
    .innerJoin('users as u', 'u.id', 'd.user_id')
    .select(['d.id', 'd.status', 'd.application_type', 'u.id as user_id', 'u.uuid as user_uuid'])
    .where('d.id', '=', applicationId)
    .executeTakeFirst()

  if (!app) throw new Error('APPLICATION_NOT_FOUND')
  if (app.status !== 'pending') throw new Error('APPLICATION_NOT_PENDING')
  // 2026-08-04 user ขอ: แอดมิน approve คำขอเป็นนักเขียนของตัวเองไม่ได้ ต้องให้คนอื่นกดให้
  // (เข้าเกณฑ์เดียวกับ CANNOT_EDIT_SELF/CANNOT_BAN_SELF ที่ใช้ทั่ว service นี้อยู่แล้ว)
  if (BigInt(app.user_id) === adminId) throw new Error('CANNOT_APPROVE_SELF')

  await db
    .updateTable('user_detail')
    .set({ status: 'approve', updated_at: new Date() })
    .where('id', '=', applicationId)
    .execute()

  // เลื่อน level 1→6 เฉพาะใบสมัครนักเขียนใหม่เท่านั้น (migration 056) — ใบ "แก้ไขข้อมูล" ของคนที่
  // เป็นนักเขียนอยู่แล้ว (level>=6) ไม่ต้องแตะ level ซ้ำ แค่ข้อมูลที่แสดงถูกยืนยันว่าใช้ได้แล้ว
  if (app.application_type === 'new_writer') {
    await setUserLevel(adminId, adminLevel, app.user_uuid, 6)
  }

  const action = app.application_type === 'edit' ? 'APPROVE_WRITER_INFO_EDIT' : 'APPROVE_WRITER_APPLICATION'
  await writeAuditLog(adminId, action, 'user_detail', String(applicationId))
}

export async function rejectWriterApplication(adminId: bigint, applicationId: bigint, reason: string) {
  const app = await db
    .selectFrom('user_detail')
    .select(['id', 'status', 'application_type'])
    .where('id', '=', applicationId)
    .executeTakeFirst()

  if (!app) throw new Error('APPLICATION_NOT_FOUND')
  if (app.status !== 'pending') throw new Error('APPLICATION_NOT_PENDING')

  await db
    .updateTable('user_detail')
    .set({ status: 'rejected', reject_reason: reason, updated_at: new Date() })
    .where('id', '=', applicationId)
    .execute()

  const action = app.application_type === 'edit' ? 'REJECT_WRITER_INFO_EDIT' : 'REJECT_WRITER_APPLICATION'
  await writeAuditLog(adminId, action, 'user_detail', String(applicationId), reason)
}

// =============================================================
// Writer Detail (ปุ่ม "ดูเพิ่มเติม" ในตาราง "นักเขียนของเว็บ", 2026-08-04)
// ดึงข้อมูลใบสมัคร (ล่าสุด ไม่ว่าสถานะไหน) + รายชื่อผลงาน ของนักเขียนคนหนึ่งมาโชว์ในหน้าต่างเดียว
// =============================================================

/** ใบสมัครล่าสุดของ user คนนี้ (ไม่ว่าสถานะไหน) — null ถ้าไม่เคยส่งเลย (เช่น legacy level 7
    หรือแอดมินที่มีผลงานแต่ไม่เคยผ่านฟอร์มสมัครนักเขียนจริง) */
export async function getWriterApplicationForUser(userUuid: string) {
  const user = await db.selectFrom('users').select('id').where('uuid', '=', userUuid).executeTakeFirst()
  if (!user) throw new Error('USER_NOT_FOUND')

  const row = await db
    .selectFrom('user_detail')
    .selectAll()
    .where('user_id', '=', user.id)
    .orderBy('created_at', 'desc')
    .executeTakeFirst()

  if (!row) return null

  return {
    id: String(row.id),
    user_prefix: row.user_prefix,
    first_name: row.first_name,
    last_name: row.last_name,
    national_id: row.national_id,
    id_address: row.id_address,
    id_province: row.id_province,
    id_district: row.id_district,
    id_subdistrict: row.id_subdistrict,
    id_postal_code: row.id_postal_code,
    current_address: row.current_address,
    current_province: row.current_province,
    current_district: row.current_district,
    current_subdistrict: row.current_subdistrict,
    current_postal_code: row.current_postal_code,
    user_phone: row.user_phone,
    bank_name: row.bank_name,
    bank_branch: row.bank_branch,
    bank_number: row.bank_number,
    status: row.status,
    application_type: row.application_type,
    reject_reason: row.reject_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/** รายชื่อผลงาน (active เท่านั้น รวม draft ที่ยังไม่เผยแพร่ด้วย — มุมมองแอดมินอยากเห็นทั้งหมด) */
export async function getWriterWorksList(userUuid: string, page: number, limit: number) {
  const user = await db.selectFrom('users').select('id').where('uuid', '=', userUuid).executeTakeFirst()
  if (!user) throw new Error('USER_NOT_FOUND')

  const offset = (page - 1) * limit

  const rows = await db
    .selectFrom('works')
    .select(['uuid', 'title', 'cover_image', 'type', 'publish_status', 'completion_status', 'view_count', 'created_at'])
    .where('author_id', '=', user.id)
    .where('status', '=', 'active')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  const countRow = await db
    .selectFrom('works')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('author_id', '=', user.id)
    .where('status', '=', 'active')
    .executeTakeFirstOrThrow()
  const total = Number(countRow.total)

  return {
    data: rows.map((r) => ({ ...r, view_count: String(r.view_count) })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

// =============================================================
// ส่วนแบ่งรายได้นักเขียน (2026-08-05, ใหม่) — user ขอเพิ่มระหว่างทำหน้าแดชบอร์ดนักเขียน: "ถ้าตั้ง
// อะไรเรียบร้อยต้องให้มันแก้ได้ผ่าน Admin site อ่ะ" — ต่อ UI/endpoint ให้ครบตามที่เคย log ค้างไว้ใน
// KNOWN_ISSUES.md ("Level 9 ปรับ % รายได้นักเขียนได้ ±8 percentage point จาก baseline เดิม")
// ใช้ users.withdrawal_rate (เก็บเป็นสัดส่วน 0-1 หน่วยเดียวกับ process.env.WITHDRAWAL_RATE, NULL =
// ใช้ค่ากลาง) — endpoint นี้แปลงเป็น % (0-100) ให้ frontend ใช้ตรงๆ ไม่ต้องแปลงเอง
// =============================================================

const REVENUE_RATE_ADJUSTMENT_PP = 8   // ปรับได้ ±8 percentage point จาก baseline (มติ 2026-08-03)

function getBaselineRevenueRatePercent(): number {
  return Number(process.env.WITHDRAWAL_RATE ?? '0.7') * 100
}

export async function getWriterRevenueRate(userUuid: string) {
  const user = await db.selectFrom('users').select('withdrawal_rate').where('uuid', '=', userUuid).executeTakeFirst()
  if (!user) throw new Error('USER_NOT_FOUND')

  const baselinePercent = getBaselineRevenueRatePercent()
  const customPercent = user.withdrawal_rate !== null ? Number(user.withdrawal_rate) * 100 : null

  return {
    custom_percent:    customPercent,
    baseline_percent:  baselinePercent,
    effective_percent: customPercent ?? baselinePercent,
    min_percent:       baselinePercent - REVENUE_RATE_ADJUSTMENT_PP,
    max_percent:       baselinePercent + REVENUE_RATE_ADJUSTMENT_PP,
  }
}

// ยอดรายได้สะสมต้องอ่านจาก ep_shop โดยตรง ไม่ใช่ users.sales: ฟิลด์ sales จะถูกหักลง
// หลังอนุมัติคำขอถอน จึงเป็น "ยอดรอถอน" ไม่ใช่ยอดขายตลอดอายุของนักเขียน.
export async function getWriterRevenueSummary(userUuid: string) {
  const user = await db
    .selectFrom('users')
    .select(['id', 'withdrawal_rate'])
    .where('uuid', '=', userUuid)
    .executeTakeFirst()
  if (!user) throw new Error('USER_NOT_FOUND')

  const sales = await db
    .selectFrom('ep_shop as shop')
    .innerJoin('works as work', 'work.p_id', 'shop.p_id')
    .select(({ fn }) => [
      fn.sum<string>('shop.price').as('gross_coin_sales'),
      fn.countAll<string>().as('purchase_count'),
    ])
    .where('work.author_id', '=', user.id)
    .executeTakeFirstOrThrow()

  const grossCoinSales = Number(sales.gross_coin_sales ?? 0)
  const effectiveRate = user.withdrawal_rate !== null
    ? Number(user.withdrawal_rate)
    : Number(process.env.WITHDRAWAL_RATE ?? '0.7')
  // ใช้สูตรเดียวกับ requestWithdrawal(): ปัดส่วนของนักเขียนลงที่ 2 ตำแหน่ง แล้วส่วนต่างคือรายได้เว็บ.
  const writerShare = Math.floor(grossCoinSales * effectiveRate * 100) / 100
  const platformRevenue = Math.round((grossCoinSales - writerShare) * 100) / 100

  return {
    gross_coin_sales: grossCoinSales,
    writer_share: writerShare,
    platform_revenue: platformRevenue,
    purchase_count: Number(sales.purchase_count ?? 0),
  }
}

/** rate_percent: null = รีเซ็ตกลับไปใช้ค่ากลาง (WITHDRAWAL_RATE จาก .env) */
export async function setWriterRevenueRate(adminId: bigint, userUuid: string, ratePercent: number | null) {
  const user = await db.selectFrom('users').select('id').where('uuid', '=', userUuid).executeTakeFirst()
  if (!user) throw new Error('USER_NOT_FOUND')

  if (ratePercent !== null) {
    const baselinePercent = getBaselineRevenueRatePercent()
    const min = baselinePercent - REVENUE_RATE_ADJUSTMENT_PP
    const max = baselinePercent + REVENUE_RATE_ADJUSTMENT_PP
    if (ratePercent < min || ratePercent > max) throw new Error('REVENUE_RATE_OUT_OF_RANGE')
  }

  await db
    .updateTable('users')
    .set({ withdrawal_rate: ratePercent !== null ? String(ratePercent / 100) : null })
    .where('id', '=', user.id)
    .execute()

  await writeAuditLog(
    adminId,
    'SET_WRITER_REVENUE_RATE',
    'user',
    String(user.id),
    ratePercent !== null ? `ส่วนแบ่งรายได้ → ${ratePercent}%` : 'รีเซ็ตส่วนแบ่งรายได้กลับเป็นค่ากลาง',
  )

  return { custom_percent: ratePercent }
}

// =============================================================
// Content Report Review (migration 025) — คิวตรวจรายงาน comment/work ที่ผู้ใช้กดรายงานมา
// level >= 8 ดูได้/resolve/dismiss ได้เลย (เป็นงาน "อนุมัติ/ตรวจสอบ" ไม่ใช่ "งานใหญ่ๆ" แบบ
// carousel/ประกาศ/settings — เข้าเกณฑ์เดียวกับ writer applications ด้านบน)
//
// ⚠️ scope รอบนี้: แค่ "ช่องรายงานรอตรวจ" ตามที่ user ขอ ("เดี๋ยวเตรียมทำช่องรายงานรอ") — resolve/
// dismiss แค่ปิดเคสในคิว ไม่ได้ลบ comment/แบน work ให้อัตโนมัติ ถ้าต้องดำเนินการจริงแอดมินต้องไปทำ
// ผ่านเครื่องมืออื่นเอง (ยังไม่มี endpoint ลบ comment ฝั่ง admin — ดู KNOWN_ISSUES.md)
// =============================================================

export async function listContentReports(params: {
  targetType?: 'comment' | 'work' | 'user'
  status?: 'pending' | 'resolved' | 'dismissed'
  category?: ReportCategory
  page: number
  limit: number
}) {
  const { targetType, status, category, page, limit } = params
  const offset = (page - 1) * limit

  let query = db
    .selectFrom('content_reports as r')
    .innerJoin('users as reporter', 'reporter.id', 'r.reported_by')
    .leftJoin('users as reviewer', 'reviewer.id', 'r.reviewed_by')
    .select([
      'r.id', 'r.target_type', 'r.target_id', 'r.reason', 'r.status',
      'r.review_note', 'r.created_at', 'r.reviewed_at',
      // migration 032: หมวดหมู่ + หมายเหตุนักเขียน (โชว์ในคิวเดิมนี้ด้วย ไม่ใช่ระบบแจ้งเตือนแยก)
      'r.category', 'r.writer_note', 'r.writer_acknowledged_at',
      'reporter.uuid as reporter_uuid', 'reporter.display_name as reporter_display_name',
      'reviewer.display_name as reviewer_display_name',
    ])

  if (targetType) query = query.where('r.target_type', '=', targetType)
  if (status)     query = query.where('r.status', '=', status)
  if (category)   query = query.where('r.category', '=', category)

  const rows = await query
    .orderBy('r.created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  let countQuery = db.selectFrom('content_reports').select(({ fn }) => fn.countAll<string>().as('total'))
  if (targetType) countQuery = countQuery.where('target_type', '=', targetType)
  if (status)     countQuery = countQuery.where('status', '=', status)
  if (category)   countQuery = countQuery.where('category', '=', category)
  const countRow = await countQuery.executeTakeFirstOrThrow()
  const total = Number(countRow.total)

  // batch ดึง preview ของเป้าหมาย — แยก query ตาม target_type (คนละตารางกัน ไม่ join ตรงๆ ได้)
  // เหมือน getAccountStatsBatch() ด้านบน ไม่ทำ subquery ต่อแถว
  const commentIds = rows.filter((r) => r.target_type === 'comment').map((r) => r.target_id)
  const workIds     = rows.filter((r) => r.target_type === 'work').map((r) => r.target_id)
  const userIds     = rows.filter((r) => r.target_type === 'user').map((r) => r.target_id)

  const [commentRows, workRows, userRows] = await Promise.all([
    commentIds.length
      ? db
          .selectFrom('work_comments as c')
          .innerJoin('users as u', 'u.id', 'c.user_id')
          .innerJoin('works as w', 'w.p_id', 'c.work_id')
          .select(['c.id', 'c.content', 'c.status', 'u.display_name as author_name', 'w.uuid as work_uuid', 'w.title as work_title'])
          .where('c.id', 'in', commentIds)
          .execute()
      : Promise.resolve([]),
    workIds.length
      ? db
          .selectFrom('works')
          .select(['p_id', 'uuid', 'title', 'status'])
          .where('p_id', 'in', workIds)
          .execute()
      : Promise.resolve([]),
    // ไม่มีสถานะ "ลบแล้ว" แยกต่างหากสำหรับ user (ระบบนี้ anonymize ตอนลบบัญชี ไม่ hard-delete แถว)
    // — exists = true เสมอถ้ายังหาแถวเจอ, display_name/uuid ที่โชว์จะเป็นชื่อ anonymized ไปเองถ้า
    // บัญชีถูกลบไปแล้วจริง ไม่ต้องเช็คแยก
    userIds.length
      ? db
          .selectFrom('users')
          .select(['id', 'uuid', 'display_name', 'u_name'])
          .where('id', 'in', userIds)
          .execute()
      : Promise.resolve([]),
  ])

  const commentMap = new Map(commentRows.map((c) => [String(c.id), c]))
  const workMap     = new Map(workRows.map((w) => [String(w.p_id), w]))
  const userMap     = new Map(userRows.map((u) => [String(u.id), u]))

  return {
    data: rows.map((r) => {
      const targetIdStr = String(r.target_id)
      const c = r.target_type === 'comment' ? commentMap.get(targetIdStr) : undefined
      const w = r.target_type === 'work' ? workMap.get(targetIdStr) : undefined
      const u = r.target_type === 'user' ? userMap.get(targetIdStr) : undefined

      const target = c
        ? { exists: c.status === 'active', preview: c.content, author_name: c.author_name, work_uuid: c.work_uuid, work_title: c.work_title, user_uuid: null, u_name: null }
        : w
        ? { exists: w.status === 'active', preview: w.title, author_name: null, work_uuid: w.uuid, work_title: w.title, user_uuid: null, u_name: null }
        : u
        ? { exists: true, preview: u.display_name, author_name: null, work_uuid: null, work_title: null, user_uuid: u.uuid, u_name: u.u_name }
        : { exists: false, preview: null, author_name: null, work_uuid: null, work_title: null, user_uuid: null, u_name: null }

      return {
        id: String(r.id),
        target_type: r.target_type,
        target_id: targetIdStr,
        target,
        reason: r.reason,
        status: r.status,
        review_note: r.review_note,
        created_at: r.created_at,
        reviewed_at: r.reviewed_at,
        category: r.category,
        writer_note: r.writer_note,
        writer_acknowledged_at: r.writer_acknowledged_at,
        reported_by: { uuid: r.reporter_uuid, display_name: r.reporter_display_name },
        reviewed_by_name: r.reviewer_display_name,
      }
    }),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

// =============================================================
// Writer Notice (migration 032) — แอดมินส่งรายงาน/แจ้งเตือนถึงนักเขียนเจ้าของผลงานตรงๆ จากหน้า
// จัดการผลงานเรื่องนั้น (คนละเรื่องกับ content_reports ที่มาจากนักอ่าน) — ยังไม่มีหน้า UI
// สำหรับ "ดูรายการที่เคยส่งไปแล้ว" ฝั่งแอดมิน มีแค่ปุ่มส่งใหม่ (ตามที่ user ขอ)
// =============================================================

export type WriterNoticeSeverity = 'normal' | 'risk' | 'critical'
export type WriterNoticeSource = 'work_notice' | 'admin_message' | 'system_action'

type WriterNoticeMetadata = Record<string, unknown>

/**
 * ส่งข้อความจากหน้าจัดการผลงานแบบเดิม โดยเก็บในกล่องรายงานเดียวกับ
 * ข้อความจากศูนย์ข้อความ เพื่อไม่ให้ข้อมูลเดิมหายหรือแยกไปอีกระบบหนึ่ง
 */
export async function createWriterNotice(adminId: bigint, workUuid: string, message: string) {
  const trimmed = message.trim()
  if (!trimmed) throw new Error('EMPTY_MESSAGE')

  const work = await db
    .selectFrom('works')
    .select(['p_id', 'author_id', 'title'])
    .where('uuid', '=', workUuid)
    .executeTakeFirst()

  if (!work) throw new Error('WORK_NOT_FOUND')

  const row = await db
    .insertInto('writer_admin_notices')
    .values({
      work_id:   work.p_id,
      writer_id: work.author_id,
      admin_id:  adminId,
      message:   trimmed,
      subject:   `ข้อความเกี่ยวกับผลงาน: ${work.title}`,
      severity:  'normal',
      source:    'work_notice',
      metadata:  JSON.stringify({ work_uuid: workUuid }),
    })
    .returning(['id', 'created_at'])
    .executeTakeFirstOrThrow()

  await writeAuditLog(adminId, 'CREATE_WRITER_NOTICE', 'writer_admin_notice', String(row.id))

  return { id: String(row.id), created_at: row.created_at }
}

/** ผู้รับที่เป็นนักเขียนจริง: level 6–7 หรือมีผลงาน active อย่างน้อยหนึ่งเรื่อง */
export async function listWriterMessageRecipients(search?: string) {
  let query = db
    .selectFrom('users as u')
    .leftJoin(
      (eb) => eb
        .selectFrom('works')
        .select(['author_id', eb.fn.countAll<string>().as('work_count')])
        .where('status', '=', 'active')
        .groupBy('author_id')
        .as('w'),
      (join) => join.onRef('w.author_id', '=', 'u.id'),
    )
    .select([
      'u.uuid',
      'u.display_name',
      'u.u_name',
      'u.level',
      'w.work_count',
    ])
    .where('u.deleted_at', 'is', null)
    .where((eb) => eb.or([
      eb.and([eb('u.level', '>=', 6), eb('u.level', '<', 8)]),
      eb('w.author_id', 'is not', null),
    ]))

  if (search?.trim()) {
    const term = `%${search.trim()}%`
    query = query.where((eb) => eb.or([
      eb('u.display_name', 'ilike', term),
      eb('u.u_name', 'ilike', term),
      eb('u.email', 'ilike', term),
    ]))
  }

  const rows = await query.orderBy('u.display_name', 'asc').limit(30).execute()
  return rows.map((row) => ({
    uuid: row.uuid,
    display_name: row.display_name,
    u_name: row.u_name,
    work_count: Number(row.work_count ?? 0),
  }))
}

/** ส่งข้อความตรงถึงนักเขียนจากศูนย์ข้อความ ไม่จำเป็นต้องผูกกับผลงาน */
export async function createDirectWriterMessage(adminId: bigint, data: {
  writerUuid: string
  subject: string
  message: string
  severity: WriterNoticeSeverity
}) {
  const subject = data.subject.trim()
  const message = data.message.trim()
  if (!subject) throw new Error('EMPTY_SUBJECT')
  if (!message) throw new Error('EMPTY_MESSAGE')

  const writer = await db
    .selectFrom('users as u')
    .leftJoin(
      (eb) => eb.selectFrom('works').select('author_id').distinct().where('status', '=', 'active').as('w'),
      (join) => join.onRef('w.author_id', '=', 'u.id'),
    )
    .select(['u.id', 'u.uuid'])
    .where('u.uuid', '=', data.writerUuid)
    .where('u.deleted_at', 'is', null)
    .where((eb) => eb.or([
      eb.and([eb('u.level', '>=', 6), eb('u.level', '<', 8)]),
      eb('w.author_id', 'is not', null),
    ]))
    .executeTakeFirst()

  if (!writer) throw new Error('WRITER_RECIPIENT_NOT_FOUND')

  const row = await db
    .insertInto('writer_admin_notices')
    .values({
      work_id: null,
      writer_id: writer.id,
      admin_id: adminId,
      subject,
      message,
      severity: data.severity,
      source: 'admin_message',
      metadata: JSON.stringify({}),
    })
    .returning(['id', 'created_at'])
    .executeTakeFirstOrThrow()

  await writeAuditLog(adminId, 'CREATE_WRITER_MESSAGE', 'writer_admin_notice', String(row.id), subject)
  return { id: String(row.id), created_at: row.created_at }
}

/**
 * เหตุการณ์ที่ระบบบันทึกแทนผู้ดูแล — ฝั่งนักเขียนเห็นผู้ส่งเป็น “อัตโนมัติ”
 * เสมอ แม้ action ต้นทางจะถูกสั่งจากหน้า admin ก็ตาม
 */
export async function createSystemWriterNotice(data: {
  writerId: bigint
  workId?: bigint | null
  subject: string
  message: string
  severity?: WriterNoticeSeverity
  metadata?: WriterNoticeMetadata
}) {
  const row = await db
    .insertInto('writer_admin_notices')
    .values({
      work_id: data.workId ?? null,
      writer_id: data.writerId,
      admin_id: null,
      subject: data.subject.trim(),
      message: data.message.trim(),
      severity: data.severity ?? 'risk',
      source: 'system_action',
      metadata: JSON.stringify(data.metadata ?? {}),
    })
    .returning(['id', 'created_at'])
    .executeTakeFirstOrThrow()

  return { id: String(row.id), created_at: row.created_at }
}

export async function listWriterMessageHistory(page: number, limit: number, source?: WriterNoticeSource) {
  const offset = (page - 1) * limit
  let query = db
    .selectFrom('writer_admin_notices as n')
    .innerJoin('users as recipient', 'recipient.id', 'n.writer_id')
    .leftJoin('users as sender', 'sender.id', 'n.admin_id')
    .leftJoin('works as w', 'w.p_id', 'n.work_id')
    .select([
      'n.id', 'n.subject', 'n.message', 'n.severity', 'n.source', 'n.metadata',
      'n.writer_note', 'n.writer_acknowledged_at', 'n.created_at',
      'recipient.uuid as recipient_uuid', 'recipient.display_name as recipient_display_name', 'recipient.u_name as recipient_u_name',
      'sender.display_name as sender_display_name',
      'w.uuid as work_uuid', 'w.title as work_title',
    ])

  if (source) query = query.where('n.source', '=', source)

  const [rows, countRow] = await Promise.all([
    query.orderBy('n.created_at', 'desc').limit(limit).offset(offset).execute(),
    (source
      ? db.selectFrom('writer_admin_notices').select(({ fn }) => fn.countAll<string>().as('total')).where('source', '=', source)
      : db.selectFrom('writer_admin_notices').select(({ fn }) => fn.countAll<string>().as('total'))
    ).executeTakeFirstOrThrow(),
  ])

  const total = Number(countRow.total)
  return {
    data: rows.map((row) => ({
      id: String(row.id),
      subject: row.subject,
      message: row.message,
      severity: row.severity,
      source: row.source,
      metadata: row.metadata,
      writer_note: row.writer_note,
      writer_acknowledged_at: row.writer_acknowledged_at,
      created_at: row.created_at,
      recipient: { uuid: row.recipient_uuid, display_name: row.recipient_display_name, u_name: row.recipient_u_name },
      sender_name: row.source === 'system_action' ? 'อัตโนมัติ' : (row.sender_display_name ?? 'ผู้ดูแล'),
      work: row.work_uuid ? { uuid: row.work_uuid, title: row.work_title } : null,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

async function getPendingReportOrThrow(reportId: bigint) {
  const report = await db
    .selectFrom('content_reports')
    .selectAll()
    .where('id', '=', reportId)
    .executeTakeFirst()

  if (!report) throw new Error('REPORT_NOT_FOUND')
  if (report.status !== 'pending') throw new Error('REPORT_NOT_PENDING')

  return report
}

export async function resolveContentReport(reviewerId: bigint, reportId: bigint, note?: string) {
  await getPendingReportOrThrow(reportId)

  await db
    .updateTable('content_reports')
    .set({ status: 'resolved', reviewed_by: reviewerId, review_note: note ?? null, reviewed_at: new Date() })
    .where('id', '=', reportId)
    .execute()

  await writeAuditLog(reviewerId, 'RESOLVE_CONTENT_REPORT', 'content_report', String(reportId), note)
}

export async function dismissContentReport(reviewerId: bigint, reportId: bigint, note?: string) {
  await getPendingReportOrThrow(reportId)

  await db
    .updateTable('content_reports')
    .set({ status: 'dismissed', reviewed_by: reviewerId, review_note: note ?? null, reviewed_at: new Date() })
    .where('id', '=', reportId)
    .execute()

  await writeAuditLog(reviewerId, 'DISMISS_CONTENT_REPORT', 'content_report', String(reportId), note)
}

// =============================================================
// Withdrawal Management
// withdrawals ใช้: approved_by, approved_at, reason (ไม่ใช่ processed_by/note)
// =============================================================

export async function listWithdrawals(params: {
  page:    number
  limit:   number
  status?: 'pending' | 'approved' | 'rejected'
}) {
  const { page, limit, status } = params
  const offset = (page - 1) * limit

  let query = db
    .selectFrom('withdrawals as w')
    .innerJoin('users as u', 'u.id', 'w.user_id')
    .leftJoin('users as approver', 'approver.id', 'w.approved_by')
    .select([
      'w.id',
      'w.amount',
      'w.net_amount',
      'w.fee_amount',
      'w.bank_code',
      'w.account_name',
      'w.account_number',
      'w.status',
      'w.reason',
      'w.created_at',
      'w.approved_at',
      'w.transfer_proof_url',
      'w.transferred_by_name',
      'u.uuid as user_uuid',
      'u.display_name',
      'u.email',
      'approver.display_name as approver_display_name',
    ])

  if (status) query = query.where('w.status', '=', status)

  const rows = await query
    .orderBy('w.created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  let countQuery = db
    .selectFrom('withdrawals')
    .select(({ fn }) => fn.countAll<string>().as('total'))

  if (status) countQuery = countQuery.where('status', '=', status)

  const countRow = await countQuery.executeTakeFirstOrThrow()
  const total    = Number(countRow.total)

  return {
    data: rows.map((r) => ({
      id:                 String(r.id),
      amount:             r.amount,
      net_amount:         r.net_amount,
      fee_amount:         r.fee_amount,
      bank_code:          r.bank_code,
      account_name:       r.account_name,
      account_number:     r.account_number,
      status:             r.status,
      reason:             r.reason,
      created_at:         r.created_at,
      approved_at:        r.approved_at,
      transfer_proof_url:   r.transfer_proof_url,
      transferred_by_name:  r.transferred_by_name,
      approved_by_name:     r.approver_display_name,
      user: {
        uuid:         r.user_uuid,
        display_name: r.display_name,
        email:        r.email,
      },
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

// migration 033: บังคับแนบ "หลักฐานการโอน" (สลิปโอนเงินจริง) ทุกครั้งที่อนุมัติ — ระบบนี้ไม่มีการ
// โอนเงินอัตโนมัติเลย (ไม่ได้ต่อ banking API) แอดมินยังต้องโอนเงินจริงเองผ่านแอปธนาคารนอกระบบ สลิป
// นี้คือหลักฐานว่าทำรายการจริงแล้ว เก็บไว้เป็น audit trail
//
// migration 034: เพิ่มบังคับพิมพ์ "ชื่อผู้อนุมัติ/ผู้โอน" (transferredByName) แยกจาก adminId
// (approved_by) — user ชี้ว่าบัญชีแอดมินอาจถูกใช้ร่วมกันหลายคนในทีมเล็กแบบนี้ พึ่ง session ที่
// ล็อกอินอยู่เฉยๆ ไม่พอจะรู้ว่า "ใคร" เป็นคนโอนเงินจริง ต้องบังคับพิมพ์ชื่อคนจริงแยกออกมาต่างหาก
export async function approveWithdrawal(
  adminId: bigint,
  withdrawalId: bigint,
  proof: { buffer: Buffer; contentType: string },
  transferredByName: string,
  reason?: string,
) {
  const trimmedName = transferredByName.trim()
  if (!trimmedName) throw new Error('TRANSFERRED_BY_NAME_REQUIRED')

  const withdrawal = await db
    .selectFrom('withdrawals')
    .select(['id', 'status', 'user_id', 'amount'])
    .where('id', '=', withdrawalId)
    .executeTakeFirst()

  if (!withdrawal)                   throw new Error('WITHDRAWAL_NOT_FOUND')
  if (withdrawal.status !== 'pending') throw new Error('WITHDRAWAL_NOT_PENDING')

  // ใช้ preset เดียวกับหลักฐานบัญชีธนาคาร (bankDocument) — ต้องคมชัดพอให้อ่านตัวเลข/ชื่อในสลิปได้
  const processed = await processImage(proof.buffer, 'bankDocument')
  const key = withdrawalProofKey(String(withdrawalId), processed.ext)
  await uploadFile(key, processed.buffer, processed.contentType)
  const proofUrl = getPublicUrl(key)

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('withdrawals')
      .set({
        status:              'approved',
        reason:              reason ?? null,
        approved_at:         new Date(),
        approved_by:         adminId,
        transfer_proof_url:  proofUrl,
        transferred_by_name: trimmedName,
      })
      .where('id', '=', withdrawalId)
      .execute()

    // หัก sales ของ writer ออก — GREATEST ป้องกัน negative
    // ⚠️ migration 031: withdrawal.amount เป็น NUMERIC(12,2) ตอนนี้ (user พิมพ์เองมีทศนิยมได้ เช่น
    // "1000.00") ต่างจากเดิมที่มาจาก users.sales (bigint) เสมอเลยไม่มีทศนิยม — ห้าม interpolate
    // string ทศนิยมเข้า SQL ตรงๆ เพราะ sales เป็น bigint จะ parse "1000.00" ไม่ผ่าน (invalid input
    // syntax for type bigint) ต้อง Math.round เป็นเลขเต็มฝั่ง JS ก่อนเสมอ
    await trx
      .updateTable('users')
      .set({ sales: sql<bigint>`GREATEST(sales - ${Math.round(Number(withdrawal.amount))}, 0)` as any })
      .where('id', '=', withdrawal.user_id)
      .execute()
  })

  await writeAuditLog(adminId, 'APPROVE_WITHDRAWAL', 'withdrawal', String(withdrawalId), reason)
}

export async function rejectWithdrawal(adminId: bigint, withdrawalId: bigint, reason: string) {
  const withdrawal = await db
    .selectFrom('withdrawals')
    .select(['id', 'status'])
    .where('id', '=', withdrawalId)
    .executeTakeFirst()

  if (!withdrawal)                   throw new Error('WITHDRAWAL_NOT_FOUND')
  if (withdrawal.status !== 'pending') throw new Error('WITHDRAWAL_NOT_PENDING')

  await db
    .updateTable('withdrawals')
    .set({
      status:      'rejected',
      reason:      reason,
      approved_at: new Date(),
      approved_by: adminId,
    })
    .where('id', '=', withdrawalId)
    .execute()

  await writeAuditLog(adminId, 'REJECT_WITHDRAWAL', 'withdrawal', String(withdrawalId), reason)
}

// =============================================================
// Bank Change Request Management (migration 031)
// อนุมัติแล้วคัดลอกค่าไปตั้งเป็นบัญชีธนาคารจริงของ user (users.bank_*)
// ⚠️ ยังไม่มีหน้า UI ฝั่ง apps/admin เรียกใช้กลุ่มฟังก์ชันนี้ (รอ design reference ตามที่ user
//    ขอไว้ — ดู KNOWN_ISSUES.md) แต่ backend พร้อมใช้งานสมบูรณ์แล้ว
// =============================================================

export async function listBankChangeRequests(params: {
  page:    number
  limit:   number
  status?: 'pending' | 'approved' | 'rejected'
}) {
  const { page, limit, status } = params
  const offset = (page - 1) * limit

  let query = db
    .selectFrom('bank_change_requests as b')
    .innerJoin('users as u', 'u.id', 'b.user_id')
    .select([
      'b.id',
      'b.bank_code',
      'b.account_name',
      'b.account_number',
      'b.reason',
      'b.document_url',
      'b.status',
      'b.review_note',
      'b.created_at',
      'b.reviewed_at',
      'u.uuid as user_uuid',
      'u.display_name',
      'u.email',
    ])

  if (status) query = query.where('b.status', '=', status)

  const rows = await query
    .orderBy('b.created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  let countQuery = db
    .selectFrom('bank_change_requests')
    .select(({ fn }) => fn.countAll<string>().as('total'))

  if (status) countQuery = countQuery.where('status', '=', status)

  const countRow = await countQuery.executeTakeFirstOrThrow()
  const total    = Number(countRow.total)

  return {
    data: rows.map((r) => ({
      id:             String(r.id),
      bank_code:      r.bank_code,
      account_name:   r.account_name,
      account_number: r.account_number,
      reason:         r.reason,
      document_url:   r.document_url,
      status:         r.status,
      review_note:    r.review_note,
      created_at:     r.created_at,
      reviewed_at:    r.reviewed_at,
      user: {
        uuid:         r.user_uuid,
        display_name: r.display_name,
        email:        r.email,
      },
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

export async function approveBankChangeRequest(adminId: bigint, requestId: bigint, note?: string) {
  const request = await db
    .selectFrom('bank_change_requests')
    .select(['id', 'status', 'user_id', 'bank_code', 'account_name', 'account_number'])
    .where('id', '=', requestId)
    .executeTakeFirst()

  if (!request)                      throw new Error('BANK_CHANGE_REQUEST_NOT_FOUND')
  if (request.status !== 'pending')  throw new Error('BANK_CHANGE_REQUEST_NOT_PENDING')

  await db.transaction().execute(async (trx) => {
    await trx
      .updateTable('bank_change_requests')
      .set({
        status:      'approved',
        review_note: note ?? null,
        reviewed_at: new Date(),
        reviewed_by: adminId,
      })
      .where('id', '=', requestId)
      .execute()

    // อนุมัติแล้ว → ตั้งเป็นบัญชีธนาคารจริงของ user ทันที
    await trx
      .updateTable('users')
      .set({
        bank_code:           request.bank_code,
        bank_account_name:   request.account_name,
        bank_account_number: request.account_number,
      })
      .where('id', '=', request.user_id)
      .execute()
  })

  await writeAuditLog(adminId, 'APPROVE_BANK_CHANGE_REQUEST', 'bank_change_request', String(requestId), note)
}

export async function rejectBankChangeRequest(adminId: bigint, requestId: bigint, note: string) {
  const request = await db
    .selectFrom('bank_change_requests')
    .select(['id', 'status'])
    .where('id', '=', requestId)
    .executeTakeFirst()

  if (!request)                      throw new Error('BANK_CHANGE_REQUEST_NOT_FOUND')
  if (request.status !== 'pending')  throw new Error('BANK_CHANGE_REQUEST_NOT_PENDING')

  await db
    .updateTable('bank_change_requests')
    .set({
      status:      'rejected',
      review_note: note,
      reviewed_at: new Date(),
      reviewed_by: adminId,
    })
    .where('id', '=', requestId)
    .execute()

  await writeAuditLog(adminId, 'REJECT_BANK_CHANGE_REQUEST', 'bank_change_request', String(requestId), note)
}

// =============================================================
// Carousel Management
// carousels ใช้: image_path (ไม่ใช่ image_url), status text, ไม่มี deleted_at
//
// 2026-08-04 ต่อจริง: เพิ่มตั้งเวลาเผยแพร่/สิ้นสุด (start_at/end_at), เวลาที่แสดงก่อนเปลี่ยนสไลด์
// (display_seconds), หมายเหตุภายใน (note, migration 028) + อัปโหลดรูปจริง (เดิม image_path เป็น
// string เปล่าๆ ที่ต้องมีไฟล์อยู่ก่อนแล้ว ไม่มี endpoint อัปโหลดเลย) + เรียงลำดับด้วยการลาก (reorder)
// =============================================================

const CAROUSEL_FIELDS = [
  'id', 'title', 'subtitle', 'image_path', 'link_url', 'sort_order', 'status',
  'start_at', 'end_at', 'display_seconds', 'note', 'created_at', 'updated_at',
] as const

export async function listCarousels() {
  const rows = await db
    .selectFrom('carousels')
    .select(CAROUSEL_FIELDS)
    .orderBy('sort_order', 'asc')
    .execute()
  return rows.map((r) => ({ ...r, id: String(r.id) }))
}

export interface CarouselInput {
  title?:            string
  subtitle?:         string | null
  link_url?:         string | null
  sort_order?:       number
  status?:           'active' | 'inactive'
  start_at?:         Date
  end_at?:            Date | null
  display_seconds?:  string
  note?:             string | null
}

export async function createCarousel(
  adminId: bigint,
  data: CarouselInput & { title: string },
  image: { buffer: Buffer; contentType: string },
) {
  if (!isAllowedImageType(image.contentType)) throw new Error('INVALID_FILE_TYPE')

  // ต้อง insert ก่อนเพื่อได้ id มาประกอบ key ของรูป (carouselKey ต้องใช้ id) — ใส่ image_path
  // ชั่วคราวว่างไว้ก่อนแล้ว update ทับด้วย URL จริงทันทีข้างล่าง — ถ้า processImage/uploadFile
  // fail กลางทาง (เจอจริงตอนทดสอบ: ไฟล์รูปเสีย/sharp อ่านไม่ออก) ต้องลบแถวที่ insert ไปแล้วทิ้ง
  // ไม่งั้นจะค้างเป็น carousel กำพร้า (title มีแต่ image_path ว่างเปล่า, ไม่มี audit log เพราะ
  // ยังไม่ถึงบรรทัดเขียน log เลย) — จับ error แล้วลบทิ้งก่อนโยน error เดิมต่อ
  const row = await db
    .insertInto('carousels')
    .values({
      title:            data.title,
      subtitle:         data.subtitle ?? null,
      image_path:       '',
      link_url:         data.link_url ?? null,
      sort_order:       data.sort_order ?? 0,
      status:           data.status ?? 'active',
      start_at:         data.start_at ?? new Date(),
      end_at:           data.end_at ?? null,
      display_seconds:  data.display_seconds ?? '5',
      note:             data.note ?? null,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow()

  let imagePath: string
  try {
    const processed = await processImage(image.buffer, 'banner')
    const key = carouselKey(String(row.id), Date.now(), processed.ext)
    await uploadFile(key, processed.buffer, processed.contentType)
    imagePath = getPublicUrl(key)
  } catch (err) {
    await db.deleteFrom('carousels').where('id', '=', row.id).execute()
    throw err
  }

  const updated = await db
    .updateTable('carousels')
    .set({ image_path: imagePath, updated_at: new Date() })
    .where('id', '=', row.id)
    .returning(CAROUSEL_FIELDS)
    .executeTakeFirstOrThrow()

  await writeAuditLog(adminId, 'CREATE_CAROUSEL', 'carousel', String(row.id), data.title)
  return { ...updated, id: String(updated.id) }
}

export async function updateCarousel(
  adminId: bigint,
  carouselId: bigint,
  data: CarouselInput,
  image?: { buffer: Buffer; contentType: string },
) {
  const existing = await db
    .selectFrom('carousels')
    .select(['id', 'image_path', 'title'])
    .where('id', '=', carouselId)
    .executeTakeFirst()

  if (!existing) throw new Error('CAROUSEL_NOT_FOUND')

  let newImagePath: string | undefined
  if (image) {
    if (!isAllowedImageType(image.contentType)) throw new Error('INVALID_FILE_TYPE')
    const processed = await processImage(image.buffer, 'banner')
    const key = carouselKey(String(carouselId), Date.now(), processed.ext)
    await uploadFile(key, processed.buffer, processed.contentType)
    newImagePath = getPublicUrl(key)
    // ลบรูปเก่าทิ้ง (กัน orphan file ค้าง R2 ตลอดไป) — เงียบๆ ถ้าลบไม่สำเร็จ ไม่ทำให้ request ทั้งก้อนพัง
    if (existing.image_path) await deleteFile(getKeyFromUrl(existing.image_path)).catch(() => {})
  }

  const updated = await db
    .updateTable('carousels')
    .set({ ...data, ...(newImagePath ? { image_path: newImagePath } : {}), updated_at: new Date() })
    .where('id', '=', carouselId)
    .returning(CAROUSEL_FIELDS)
    .executeTakeFirstOrThrow()

  await writeAuditLog(adminId, 'UPDATE_CAROUSEL', 'carousel', String(carouselId), data.title ?? existing.title ?? undefined)
  return { ...updated, id: String(updated.id) }
}

export async function deleteCarousel(adminId: bigint, carouselId: bigint) {
  const existing = await db
    .selectFrom('carousels')
    .select(['id', 'image_path', 'title'])
    .where('id', '=', carouselId)
    .executeTakeFirst()

  if (!existing) throw new Error('CAROUSEL_NOT_FOUND')

  // hard delete — carousels ไม่มี deleted_at และ type ไม่รองรับ 'deleted'
  await db
    .deleteFrom('carousels')
    .where('id', '=', carouselId)
    .execute()

  if (existing.image_path) await deleteFile(getKeyFromUrl(existing.image_path)).catch(() => {})

  await writeAuditLog(adminId, 'DELETE_CAROUSEL', 'carousel', String(carouselId), existing.title ?? undefined)
}

/** ลาก-วางจัดลำดับใหม่ — ส่ง id มาตามลำดับที่ต้องการ (index ในอาร์เรย์ = sort_order ใหม่) */
export async function reorderCarousels(adminId: bigint, orderedIds: bigint[]) {
  await Promise.all(
    orderedIds.map((id, index) =>
      db.updateTable('carousels').set({ sort_order: index, updated_at: new Date() }).where('id', '=', id).execute()
    ),
  )
  await writeAuditLog(adminId, 'REORDER_CAROUSEL', 'carousel', orderedIds.map(String).join(','))
}

// =============================================================
// Featured Works — "นิยายแนะนำแบบ Cheesy" (migration 028, 2026-08-04)
// บูสต์ผลงานที่เลือกเองให้ไปปนอยู่ใน 1 ใน 3 แถวหน้าแรกจริง (section ตรงกับค่า sort ของ
// GET /works: sales="เรื่องเด่นประจำสัปดาห์", popular="นิยมตลอดกาล", latest="ใหม่ล่าสุด")
// ดู getHomeSection() ใน works.service.ts ฝั่งสาธารณะสำหรับตรงที่ผสมเข้ากับผลงานจริง
//
// user ยืนยันแล้ว (2026-08-04): ตัวเลขสถิติที่โชว์ในตาราง "จำลองหน้า Home" ต้องเป็นของจริง 100%
// เสมอ ห้ามให้แอดมินพิมพ์เลขปลอมแทน — ฟังก์ชันด้านล่างเลยไม่มี field ไหนให้ override ตัวเลขเลย
// =============================================================

const DEFAULT_FEATURED_DURATION_DAYS = 7
// คำแนะนำ (ไม่ใช่ hard limit — "ไม่ควรใส่เกิน 2 เรื่อง") กันแถวดูไม่สดใหม่ ใช้แค่ขึ้นเตือนใน UI
export const FEATURED_RECOMMENDED_MAX = 2

export async function listFeaturedWorks() {
  const rows = await db
    .selectFrom('featured_works as f')
    .innerJoin('works as w', 'w.p_id', 'f.p_id')
    .select([
      'f.id', 'f.section', 'f.sort_order', 'f.expires_at', 'f.created_at',
      'w.uuid as work_uuid', 'w.title', 'w.cover_image',
    ])
    .where('f.expires_at', '>=', sql<Date>`now()`)
    .orderBy('f.section', 'asc')
    .orderBy('f.sort_order', 'asc')
    .execute()

  return rows.map((r) => ({
    id: String(r.id),
    section: r.section,
    sort_order: r.sort_order,
    expires_at: r.expires_at,
    created_at: r.created_at,
    work: { uuid: r.work_uuid, title: r.title, cover_image: r.cover_image },
  }))
}

export async function addFeaturedWork(
  adminId: bigint,
  params: { workUuid: string; section: 'sales' | 'popular' | 'latest'; durationDays?: number },
) {
  const work = await db.selectFrom('works').select(['p_id', 'publish_status']).where('uuid', '=', params.workUuid).where('status', '=', 'active').executeTakeFirst()
  if (!work) throw new Error('WORK_NOT_FOUND')
  // 2026-08-04 เจอตอนทดสอบ: บูสต์เรื่อง draft เข้าคิวได้ แต่ไม่โผล่หน้าเว็บจริงเลยเพราะ getWorks()
  // (ที่ getHomeSection() เรียกใช้) กรอง publish_status=1 เสมอ — กันตั้งแต่ backend เป็นชั้นสุดท้าย
  // (ชั้นแรกกันที่ picker ฝั่ง frontend ผ่าน published_only=true อยู่แล้ว)
  if (work.publish_status !== 1) throw new Error('WORK_NOT_PUBLISHED')

  const already = await db
    .selectFrom('featured_works')
    .select('id')
    .where('p_id', '=', work.p_id)
    .where('section', '=', params.section)
    .where('expires_at', '>=', sql<Date>`now()`)
    .executeTakeFirst()
  if (already) throw new Error('ALREADY_FEATURED')

  const maxSort = await db
    .selectFrom('featured_works')
    .select(({ fn }) => fn.max('sort_order').as('max'))
    .where('section', '=', params.section)
    .where('expires_at', '>=', sql<Date>`now()`)
    .executeTakeFirst()

  const durationDays = params.durationDays ?? DEFAULT_FEATURED_DURATION_DAYS
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)

  const row = await db
    .insertInto('featured_works')
    .values({
      p_id:       work.p_id,
      section:    params.section,
      sort_order: (maxSort?.max ?? -1) + 1,
      expires_at: expiresAt,
      created_by: adminId,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow()

  await writeAuditLog(adminId, 'ADD_FEATURED_WORK', 'featured_work', String(row.id), `${params.section}: ${params.workUuid}`)
  return { id: String(row.id) }
}

export async function removeFeaturedWork(adminId: bigint, id: bigint) {
  const existing = await db.selectFrom('featured_works').select(['id', 'section', 'p_id']).where('id', '=', id).executeTakeFirst()
  if (!existing) throw new Error('FEATURED_WORK_NOT_FOUND')

  await db.deleteFrom('featured_works').where('id', '=', id).execute()
  await writeAuditLog(adminId, 'REMOVE_FEATURED_WORK', 'featured_work', String(id), existing.section)
}

export async function reorderFeaturedWorks(adminId: bigint, section: 'sales' | 'popular' | 'latest', orderedIds: bigint[]) {
  await Promise.all(
    orderedIds.map((id, index) =>
      db.updateTable('featured_works').set({ sort_order: index }).where('id', '=', id).where('section', '=', section).execute()
    ),
  )
  await writeAuditLog(adminId, 'REORDER_FEATURED_WORK', 'featured_work', orderedIds.map(String).join(','), section)
}

// ---- "จำลองหน้า Home" — พรีวิว 3 คอลัมน์ตามที่ user ขอ ----
// ต่อคอลัมน์: ผลงานที่บูสต์ไว้ (เรียงตาม sort_order) ตามด้วยผลงานจริงตามลำดับเดียวกับที่จะขึ้นหน้า
// เว็บจริง (ตัด boosted ที่ซ้ำออกจาก organic กันโชว์ซ้ำ) — สถิติทุกตัวเป็นของจริงเสมอ อ่านจากตาราง
// จริงตรงๆ ไม่มี field ไหนให้แก้ไข/พิมพ์แทนได้เลยตามที่ user ยืนยัน
const SECTIONS = ['sales', 'popular', 'latest'] as const

async function getWorkPerformanceStats(pIds: bigint[]) {
  const readsToday: Record<string, number> = {}
  const monthlyEarnings: Record<string, number> = {}
  const episodeCounts: Record<string, number> = {}

  if (pIds.length === 0) return { readsToday, monthlyEarnings, episodeCounts }

  const [readsRows, earningsRows, epRows] = await Promise.all([
    db.selectFrom('work_ep_views')
      .select(['p_id', ({ fn }) => fn.countAll<string>().as('c')])
      .where('p_id', 'in', pIds)
      .where(sql<boolean>`created_at >= now() - interval '1 day'`)
      .groupBy('p_id')
      .execute(),
    db.selectFrom('ep_shop')
      .select(['p_id', ({ fn }) => fn.sum<string>('price').as('s')])
      .where('p_id', 'in', pIds)
      .where(sql<boolean>`created_at >= now() - interval '30 days'`)
      .groupBy('p_id')
      .execute(),
    db.selectFrom('work_ep')
      .select(['p_id', ({ fn }) => fn.countAll<string>().as('c')])
      .where('p_id', 'in', pIds)
      .where('status', '=', 'active')
      .groupBy('p_id')
      .execute(),
  ])

  for (const r of readsRows) readsToday[String(r.p_id)] = Number(r.c)
  for (const r of earningsRows) monthlyEarnings[String(r.p_id)] = Number(r.s ?? 0)
  for (const r of epRows) episodeCounts[String(r.p_id)] = Number(r.c)

  return { readsToday, monthlyEarnings, episodeCounts }
}

export async function getFeaturedPreview(baseLimit = 12) {
  const featuredRows = await db
    .selectFrom('featured_works as f')
    .innerJoin('works as w', 'w.p_id', 'f.p_id')
    .select(['f.id', 'f.section', 'f.sort_order', 'f.expires_at', 'w.p_id', 'w.uuid', 'w.title', 'w.cover_image', 'w.view_count'])
    .where('f.expires_at', '>=', sql<Date>`now()`)
    .orderBy('f.sort_order', 'asc')
    .execute()

  // organic top N ต่อ section ตาม sort เดียวกับหน้าแรกจริง (sales=ยอดขาย, popular=ยอดวิว,
  // latest=ล่าสุด) — ทำ query ตรงๆ ที่นี่แทนเรียก getWorks() ของ works.service.ts เพื่อกัน
  // import ข้าม module ไปมาโดยไม่จำเป็น (แค่ต้องการ p_id/title/cover/view_count พอ ไม่ต้องเต็มรูป
  // แบบที่ public API ใช้)
  const organicBySection: Record<string, { p_id: bigint; uuid: string; title: string; cover_image: string | null; view_count: bigint }[]> = {}

  for (const section of SECTIONS) {
    const excludeIds = featuredRows.filter((f) => f.section === section).map((f) => f.p_id)
    // ต้องกรองเงื่อนไขเดียวกับ query สาธารณะทุกตัว (getWorks/getWorkByUuid) เป๊ะ — ไม่งั้นพรีวิวจะ
    // โชว์เรื่อง draft/ถูกลบ/ถูกแบนราวกับติดอันดับจริง ทั้งที่ผู้ใช้จริงมองไม่เห็นเลย (เจอบั๊กนี้
    // จาก user ทดสอบ 2026-08-05 — เดิมกรองแค่ status='active' ตัวเดียว)
    let q = db
      .selectFrom('works')
      .select(['p_id', 'uuid', 'title', 'cover_image', 'view_count'])
      .where('status', '=', 'active')
      .where('publish_status', '=', 1)
      .where('deleted_at', 'is', null)
      .where('banned', 'is', null)
    if (excludeIds.length > 0) q = q.where('p_id', 'not in', excludeIds)

    if (section === 'sales') {
      // ไม่มีคอลัมน์ sales รวมบน works ตรงๆ (sales นับจาก ep_shop เหมือน works.service.ts) —
      // ใช้ view_count แทนไปก่อนให้ตรงกับพฤติกรรม fallback เดียวกับที่อื่น เอาแค่พรีวิวคร่าวๆ
      q = q.orderBy('view_count', 'desc')
    } else if (section === 'popular') {
      q = q.orderBy('view_count', 'desc')
    } else {
      q = q.orderBy('created_at', 'desc')
    }

    organicBySection[section] = await q.limit(baseLimit).execute()
  }

  const allPIds = [
    ...featuredRows.map((f) => f.p_id),
    ...Object.values(organicBySection).flatMap((rows) => rows.map((r) => r.p_id)),
  ]
  const stats = await getWorkPerformanceStats(allPIds)

  const result: Record<string, any[]> = {}
  for (const section of SECTIONS) {
    const boosted = featuredRows
      .filter((f) => f.section === section)
      .map((f) => ({
        featured_id:     String(f.id),
        uuid:            f.uuid,
        title:           f.title,
        cover_image:     f.cover_image,
        is_boosted:      true,
        expires_at:      f.expires_at,
        reads_today:     stats.readsToday[String(f.p_id)] ?? 0,
        total_reads:     Number(f.view_count),
        episode_count:   stats.episodeCounts[String(f.p_id)] ?? 0,
        monthly_earning: stats.monthlyEarnings[String(f.p_id)] ?? 0,
      }))
    const organic = organicBySection[section].map((r) => ({
      featured_id:     null,
      uuid:            r.uuid,
      title:           r.title,
      cover_image:     r.cover_image,
      is_boosted:      false,
      expires_at:      null,
      reads_today:     stats.readsToday[String(r.p_id)] ?? 0,
      total_reads:     Number(r.view_count),
      episode_count:   stats.episodeCounts[String(r.p_id)] ?? 0,
      monthly_earning: stats.monthlyEarnings[String(r.p_id)] ?? 0,
    }))
    result[section] = [...boosted, ...organic]
  }

  return result
}

// =============================================================
// Announcement Management
// announcements ใช้: status text, created_by, ไม่มี deleted_at
// =============================================================

export async function listAnnouncements(includeInactive = false) {
  let query = db
    .selectFrom('announcements as a')
    .leftJoin('users as creator', 'creator.id', 'a.created_by')
    .select([
      'a.id', 'a.title', 'a.content', 'a.status', 'a.color', 'a.created_by', 'a.created_at', 'a.updated_at',
      'creator.display_name as created_by_name',
    ])
    .orderBy('a.created_at', 'desc')

  if (!includeInactive) {
    query = query.where('a.status', '=', 'active')
  }

  const rows = await query.execute()
  return rows.map((row) => ({
    ...row,
    id: String(row.id),
    created_by: row.created_by === null ? null : String(row.created_by),
    created_by_name: row.created_by_name ?? 'ทีม Readji',
  }))
}

export async function createAnnouncement(adminId: bigint, data: {
  title:    string
  content:  string
  status?:  'active' | 'inactive'
  color?:   'green' | 'red' | 'purple' | 'gold'
}) {
  const row = await db
    .insertInto('announcements')
    .values({
      title:      data.title,
      content:    data.content,
      status:     data.status ?? 'active',
      color:      data.color ?? 'gold',
      created_by: adminId,
    })
    .returning(['id', 'title', 'content', 'status', 'color', 'created_at'])
    .executeTakeFirstOrThrow()

  await writeAuditLog(adminId, 'CREATE_ANNOUNCEMENT', 'announcement', String(row.id))
  return { ...row, id: String(row.id) }
}

export async function updateAnnouncement(adminId: bigint, announcementId: bigint, data: {
  title?:   string
  content?: string
  status?:  'active' | 'inactive'
  color?:   'green' | 'red' | 'purple' | 'gold'
}) {
  const existing = await db
    .selectFrom('announcements')
    .select('id')
    .where('id', '=', announcementId)
    .executeTakeFirst()

  if (!existing) throw new Error('ANNOUNCEMENT_NOT_FOUND')

  const updated = await db
    .updateTable('announcements')
    .set({ ...data, updated_at: new Date() })
    .where('id', '=', announcementId)
    .returning(['id', 'title', 'content', 'status', 'color', 'updated_at'])
    .executeTakeFirstOrThrow()

  await writeAuditLog(adminId, 'UPDATE_ANNOUNCEMENT', 'announcement', String(announcementId))
  return { ...updated, id: String(updated.id) }
}

export async function deleteAnnouncement(adminId: bigint, announcementId: bigint) {
  const existing = await db
    .selectFrom('announcements')
    .select('id')
    .where('id', '=', announcementId)
    .executeTakeFirst()

  if (!existing) throw new Error('ANNOUNCEMENT_NOT_FOUND')

  // hard delete — announcements ไม่มี deleted_at และ type ไม่รองรับ 'deleted'
  await db
    .deleteFrom('announcements')
    .where('id', '=', announcementId)
    .execute()

  await writeAuditLog(adminId, 'DELETE_ANNOUNCEMENT', 'announcement', String(announcementId))
}

// =============================================================
// Web Settings
// =============================================================

export async function getWebSettings() {
  const rows = await db
    .selectFrom('web_setting')
    .selectAll()
    .execute()

  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export async function updateWebSettings(adminId: bigint, settings: Record<string, string>) {
  await Promise.all(
    Object.entries(settings).map(([key, value]) =>
      db
        .insertInto('web_setting')
        .values({ key, value })
        .onConflict((oc) => oc.column('key').doUpdateSet({ value, updated_at: new Date() }))
        .execute()
    )
  )

  await writeAuditLog(adminId, 'UPDATE_SETTINGS', 'web_setting', 'all', JSON.stringify(settings))
}

// =============================================================
// Audit Logs
// audit_logs ใช้: user_id, event_type, description, metadata
// =============================================================

export async function getAuditLogs(params: {
  page:         number
  limit:        number
  event_type?:  string
  /** กรองจากหลายประเภทพร้อมกัน (IN list) — ใช้กับแท็บ "ประวัติ" ย่อยใน "ตั้งหน้าเว็บไซต์"
      ที่ต้องโชว์ทั้ง carousel และ นิยายแนะนำ พร้อมกันโดย default (2026-08-04) — คนละ param กับ
      event_type ด้านบน (single, ใช้กับหน้า "ประวัติ" ทั่วไปที่เลือกได้ทีละประเภท) ไม่ทับกัน */
  event_types?: string[]
  /** ค้นข้อความ (description) หรือชื่อแอดมินที่ทำรายการ — เพิ่มเข้ามาให้ "ดูได้ทั้งหมด" ใช้งานจริง
      ได้เมื่อ log เยอะขึ้น ไม่ใช่แค่กรองตามประเภทอย่างเดียว (2026-08-04) */
  search?:      string
}) {
  const { page, limit, event_type, event_types, search } = params
  const offset = (page - 1) * limit

  let query = db
    .selectFrom('audit_logs as a')
    .innerJoin('users as u', 'u.id', 'a.user_id')
    .select([
      'a.id',
      'a.event_type',
      'a.description',
      'a.metadata',
      'a.created_at',
      'u.uuid as admin_uuid',
      'u.display_name as admin_name',
    ])

  if (event_type) query = query.where('a.event_type', '=', event_type)
  if (event_types && event_types.length > 0) query = query.where('a.event_type', 'in', event_types)
  if (search) {
    query = query.where((eb) =>
      eb.or([
        eb('a.description', 'ilike', `%${search}%`),
        eb('u.display_name', 'ilike', `%${search}%`),
        eb('u.u_name', 'ilike', `%${search}%`),
      ])
    )
  }

  const rows = await query
    .orderBy('a.created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  // ⚠️ เดิม countQuery ไม่ apply filter เลย (bug) — pagination.total/pages ผิดตอนกรองอยู่
  // (นับทุกแถวในตารางเสมอ ไม่ว่าจะกรอง event_type/search แค่ไหน) แก้ให้ apply filter เดียวกับ
  // query ด้านบนแล้ว (2026-08-04 เจอตอนต่อหน้า "ประวัติ" ให้ทำงานจริง)
  let countQuery = db
    .selectFrom('audit_logs as a')
    .innerJoin('users as u', 'u.id', 'a.user_id')
    .select(({ fn }) => fn.countAll<string>().as('total'))

  if (event_type) countQuery = countQuery.where('a.event_type', '=', event_type)
  if (event_types && event_types.length > 0) countQuery = countQuery.where('a.event_type', 'in', event_types)
  if (search) {
    countQuery = countQuery.where((eb) =>
      eb.or([
        eb('a.description', 'ilike', `%${search}%`),
        eb('u.display_name', 'ilike', `%${search}%`),
        eb('u.u_name', 'ilike', `%${search}%`),
      ])
    )
  }

  const countRow = await countQuery.executeTakeFirstOrThrow()
  const total = Number(countRow.total)

  return {
    data: rows.map((r) => ({ ...r, id: String(r.id) })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

/** ประเภท event ทั้งหมดที่เคยเกิดจริงในระบบ — ใช้สร้าง dropdown กรองในหน้า "ประวัติ"
    (ไม่ hardcode list ไว้ตรงๆ เพราะ event_type ใหม่จะถูกเพิ่มเรื่อยๆ ตามฟีเจอร์ที่ทำเพิ่ม) */
export async function getAuditLogEventTypes() {
  const rows = await db
    .selectFrom('audit_logs')
    .select('event_type')
    .distinct()
    .orderBy('event_type', 'asc')
    .execute()
  return rows.map((r) => r.event_type)
}
