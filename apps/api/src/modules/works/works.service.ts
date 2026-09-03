// =============================================================
// Novel Platform — Works Service
// วางไว้ที่: apps/api/src/modules/works/works.service.ts
// =============================================================

import { db } from '../../db'
import { sql } from 'kysely'
import { getEpisodeAudioForBlocks } from '../tts/tts.service'

// ---- Types สำหรับ Query Params ----

export type GetWorksParams = {
  page: number
  limit: number
  type?: 'manga' | 'novel'
  category_id?: bigint
  // หน้า /search แยก main/sub เป็นคนละ filter (AND กัน) — ต่างจาก category_id เดิม
  // ที่ OR ทั้งสองฝั่ง (ใช้ในหน้า Home ยังคงพฤติกรรมเดิมไว้ ไม่แตะ)
  category_main_id?: bigint
  category_sub_id?: bigint
  tags?: string[]                                            // filter หมวดหมู่ย่อย (works.tags array overlap — ANY match)
  // 2026-08-17 — เมนู "การแสดงผลเนื้อหา" (หัวใจ navbar) ต้องการ AND/NOT แยกจาก tags (ANY) เดิม —
  // tags_all: ต้องมีครบทุก tag ในลิสต์ (ใช้กับโหมด "เฉพาะ BL"/"เฉพาะ GL"), tags_none: ต้องไม่มี
  // tag ไหนในลิสต์เลย (ใช้กับโหมด "ซ่อน BL"/"ซ่อน GL") — คนละ query กับ tags (ANY) เดิม เผื่อ
  // จุดอื่นยังใช้ ANY-match อยู่ (เช่น autocomplete ค้นหาจากหลาย tag พร้อมกัน)
  tags_all?: string[]
  tags_none?: string[]
  completion_status?: 'ongoing' | 'completed' | 'hiatus'
  // sort=sales ใช้กรองช่วงเวลาของการซื้อจริง; sort อื่นใช้วันที่สร้างผลงาน
  date_range?: 'today' | 'week' | 'month' | 'year'            // undefined = ตลอดกาล
  age_rate?: 'all' | '18+'                                    // 2026-07-30 หน้า /search — toggle บังคับเลือกเสมอ (ไม่มีค่า "ทั้งคู่")
  is_one_shot?: boolean                                       // 2026-07-30 หน้า /search — toggle "เรื่องยาว/One shot" เหมือนกัน
  // 'sales' ใหม่ (2026-07-30) — นับจำนวนครั้งที่มีคนซื้อตอนในเรื่องนี้ (ep_shop) ใช้กับ
  // "ยอดขายสูงสุด" ในหน้า /search และ "เรื่องเด่นประจำสัปดาห์" หน้าแรก (ดึงรายได้เข้าเว็บ)
  sort: 'latest' | 'popular' | 'likes' | 'comments' | 'updated' | 'sales'
  sort_dir?: 'asc' | 'desc'                                   // default 'desc'
  search?: string
  search_field?: 'title' | 'author'                           // default 'title'
  // ผลงานของนักเขียนคนไหนคนหนึ่งโดยเฉพาะ — ใช้ในหน้าโปรไฟล์ (แท็บ "แนะนำ"/"ทั้งหมด",
  // 2026-07-29 มติแก้ว่าเป็นผลงานที่เจ้าของโปรไฟล์เผยแพร่เอง ไม่ใช่นิยายที่เก็บเข้าคลังไว้)
  author_id?: bigint
  // นักเขียนหลายคนพร้อมกัน (author_id เดี่ยวด้านบนใช้ไม่ได้กับกรณีนี้) — ใช้ในหน้า Feed
  // ส่วน "นักเขียนที่ติดตาม" (2026-07-29) กรอง author_id IN (รายชื่อที่ follow อยู่)
  author_ids?: bigint[]
  featured?: boolean                                          // เฉพาะที่ปักหมุดไว้เป็น "แนะนำ" (สูงสุด 8 เรื่อง)
  // 2026-08-04 — ใช้กับ getHomeSection() (ระบบ "นิยายแนะนำ" บูสต์หน้าแรก): uuids ดึงเฉพาะที่
  // ระบุมา (ได้การ์ดเต็มรูปแบบเดียวกับผลงานอื่นทุกฟิลด์ ไม่ต้องเขียน mapping ซ้ำ), exclude_uuids
  // ตัดออกจากผลลัพธ์ organic กันโชว์ซ้ำกับที่ boost ไปแล้ว
  uuids?: string[]
  exclude_uuids?: string[]
}

// ---- Helper: นับ episode/like/comment ต่อ work หลายเรื่องพร้อมกัน (ใช้ทั้งใน getWorks) ----
// แยกฟังก์ชันนี้ออกมาเพราะต้องเรียกใช้ 2 จุด (sort แบบปกติ vs sort แบบ likes/comments
// ที่ต้องนับก่อนถึงจะเรียงได้ — ดู comment ใน getWorks ด้านล่าง) — export ไว้ให้
// getBookmarks() (social.service.ts) เรียกใช้ซ้ำด้วย (หน้าโปรไฟล์ "กล่องเก็บนิยาย")
export async function getWorkCounts(pIds: bigint[]) {
  const episodeCounts: Record<string, number> = {}
  const likeCounts: Record<string, number> = {}
  const commentCounts: Record<string, number> = {}

  if (pIds.length === 0) return { episodeCounts, likeCounts, commentCounts }

  const [episodes, likes, comments] = await Promise.all([
    db.selectFrom('work_ep')
      .select(['p_id', ({ fn }) => fn.countAll<string>().as('count')])
      .where('p_id', 'in', pIds)
      .where('status', '=', 'active')
      .where((eb) => eb.or([
        eb('publish_status', '=', 'now'),
        eb.and([eb('publish_status', '=', 'schedule'), eb('schedule_datetime', '<=', new Date())]),
      ]))
      .groupBy('p_id')
      .execute(),
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

  for (const e of episodes) episodeCounts[String(e.p_id)] = Number(e.count)
  for (const l of likes) likeCounts[String(l.p_id)] = Number(l.count)
  for (const c of comments) commentCounts[String(c.work_id)] = Number(c.count)

  return { episodeCounts, likeCounts, commentCounts }
}

function getDateRangeStart(dateRange: GetWorksParams['date_range']): Date | undefined {
  if (!dateRange) return undefined

  const since = new Date()
  if (dateRange === 'today') since.setDate(since.getDate() - 1)
  else if (dateRange === 'week') since.setDate(since.getDate() - 7)
  else if (dateRange === 'month') since.setMonth(since.getMonth() - 1)
  else if (dateRange === 'year') since.setFullYear(since.getFullYear() - 1)
  return since
}

// ---- Helper: แปลง bigint → string (JSON ไม่รู้จัก bigint) ----
// ทำไมต้องแปลง? JSON.stringify จะ throw error ถ้าเจอ bigint
// ใน PostgreSQL: BIGINT → bigint ใน JS → ต้องแปลงเป็น string ก่อนส่งออก API

function bigintToString(val: bigint | null | undefined): string | null {
  if (val == null) return null
  return String(val)
}

// ---- GET /works ----
// ดึงรายการผลงานแบบ paginated พร้อม filter และ sort

export async function getWorks(params: GetWorksParams) {
  const offset = (params.page - 1) * params.limit

  // ---- Data query ----
  // innerJoin users เพื่อดึงข้อมูล author
  // leftJoin categories 2 ครั้ง: cm = category_main, cs = category_sub
  // ใช้ leftJoin เพราะ category อาจเป็น null ได้
  let dataQuery = db
    .selectFrom('works as c')
    .innerJoin('users as u', 'u.id', 'c.author_id')
    .leftJoin('categories as cm', 'cm.id', 'c.category_main')
    .leftJoin('categories as cs', 'cs.id', 'c.category_sub')
    .select([
      'c.p_id',
      'c.uuid',
      'c.title',
      'c.description',
      'c.cover_image',
      'c.type',
      'c.origin_type',
      'c.age_rate',
      'c.completion_status',
      'c.view_count',
      'c.tags',
      'c.featured',
      'c.created_at',
      'c.updated_at',
      'u.uuid as author_uuid',
      'u.display_name as author_display_name',
      'u.user_img as author_img',
      'cm.id as category_main_id',
      'cm.name as category_main_name',
      'cs.id as category_sub_id',
      'cs.name as category_sub_name',
    ])
    // เฉพาะที่ publish แล้ว (1), ยัง active, ยังไม่ถูกลบ, ไม่ถูกแบน
    .where('c.publish_status', '=', 1)
    .where('c.status', '=', 'active')
    .where('c.deleted_at', 'is', null)
    .where('c.banned', 'is', null)

  // ---- Count query ----
  // join users เข้ามาด้วยเสมอ (เดิมไม่ join เพื่อความเร็ว แต่ตอนนี้ต้องรองรับค้นจาก
  // ชื่อนักเขียนด้วย — join กับ FK ที่มี index อยู่แล้ว ต้นทุนไม่สูง)
  let countQuery = db
    .selectFrom('works as c')
    .innerJoin('users as u', 'u.id', 'c.author_id')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('c.publish_status', '=', 1)
    .where('c.status', '=', 'active')
    .where('c.deleted_at', 'is', null)
    .where('c.banned', 'is', null)

  // ---- Optional filters ----
  // ทำไมต้องใส่ 2 ครั้ง (dataQuery + countQuery)?
  // Kysely ทำงานแบบ immutable — ทุก .where() คืน query ใหม่
  // dataQuery และ countQuery เป็น object คนละตัว จึงต้อง filter แยก

  if (params.type) {
    dataQuery = dataQuery.where('c.type', '=', params.type)
    countQuery = countQuery.where('c.type', '=', params.type)
  }

  if (params.author_id) {
    dataQuery = dataQuery.where('c.author_id', '=', params.author_id)
    countQuery = countQuery.where('c.author_id', '=', params.author_id)
  }

  if (params.author_ids && params.author_ids.length > 0) {
    dataQuery = dataQuery.where('c.author_id', 'in', params.author_ids)
    countQuery = countQuery.where('c.author_id', 'in', params.author_ids)
  }

  if (params.featured) {
    dataQuery = dataQuery.where('c.featured', '=', true)
    countQuery = countQuery.where('c.featured', '=', true)
  }

  if (params.uuids && params.uuids.length > 0) {
    dataQuery = dataQuery.where('c.uuid', 'in', params.uuids)
    countQuery = countQuery.where('c.uuid', 'in', params.uuids)
  }

  if (params.exclude_uuids && params.exclude_uuids.length > 0) {
    dataQuery = dataQuery.where('c.uuid', 'not in', params.exclude_uuids)
    countQuery = countQuery.where('c.uuid', 'not in', params.exclude_uuids)
  }

  if (params.category_id) {
    // ค้นหาทั้ง category_main และ category_sub
    dataQuery = dataQuery.where((eb) =>
      eb.or([
        eb('c.category_main', '=', params.category_id!),
        eb('c.category_sub', '=', params.category_id!),
      ])
    )
    countQuery = countQuery.where((eb) =>
      eb.or([
        eb('c.category_main', '=', params.category_id!),
        eb('c.category_sub', '=', params.category_id!),
      ])
    )
  }

  // หน้า /search — main/sub เป็นคนละ filter, AND กัน (ต่างจาก category_id เดิมที่ OR)
  if (params.category_main_id) {
    dataQuery = dataQuery.where('c.category_main', '=', params.category_main_id)
    countQuery = countQuery.where('c.category_main', '=', params.category_main_id)
  }
  if (params.category_sub_id) {
    dataQuery = dataQuery.where('c.category_sub', '=', params.category_sub_id)
    countQuery = countQuery.where('c.category_sub', '=', params.category_sub_id)
  }

  // หมวดหมู่ย่อย (tags) — works.tags เป็น TEXT[] ธรรมดา ไม่ผูกกับตาราง categories
  // ใช้ && (array overlap operator) เช็คว่ามี tag ไหนตรงกันอย่างน้อย 1 อัน
  if (params.tags && params.tags.length > 0) {
    dataQuery = dataQuery.where(sql<boolean>`c.tags && ${params.tags}`)
    countQuery = countQuery.where(sql<boolean>`c.tags && ${params.tags}`)
  }

  // ต้องมี tag ครบทุกอันในลิสต์ (@> = contains-all) — โหมด "เฉพาะ BL"/"เฉพาะ GL" ของเมนูหัวใจ
  if (params.tags_all && params.tags_all.length > 0) {
    dataQuery = dataQuery.where(sql<boolean>`c.tags @> ${params.tags_all}`)
    countQuery = countQuery.where(sql<boolean>`c.tags @> ${params.tags_all}`)
  }

  // ต้องไม่มี tag ไหนในลิสต์เลย (negate && ) — โหมด "ซ่อน BL"/"ซ่อน GL" ของเมนูหัวใจ
  if (params.tags_none && params.tags_none.length > 0) {
    dataQuery = dataQuery.where(sql<boolean>`NOT (c.tags && ${params.tags_none})`)
    countQuery = countQuery.where(sql<boolean>`NOT (c.tags && ${params.tags_none})`)
  }

  if (params.completion_status) {
    dataQuery = dataQuery.where('c.completion_status', '=', params.completion_status)
    countQuery = countQuery.where('c.completion_status', '=', params.completion_status)
  }

  // toggle "ทั่วไป/18+/ทั้งหมด" หน้า /search (2026-07-30, ปรับเป็น 3 ทางเลือก 2026-08-17) —
  // ไม่ส่ง param นี้มาเลย = "ทั้งหมด" (ไม่ filter) เดิมเป็น toggle 2 ทางบังคับเลือกเสมอ
  if (params.age_rate) {
    dataQuery = dataQuery.where('c.age_rate', '=', params.age_rate)
    countQuery = countQuery.where('c.age_rate', '=', params.age_rate)
  }

  // toggle "เรื่องยาว/One shot" หน้า /search (2026-07-30) — เหตุผลเดียวกับ age_rate ด้านบน
  if (params.is_one_shot !== undefined) {
    dataQuery = dataQuery.where('c.is_one_shot', '=', params.is_one_shot)
    countQuery = countQuery.where('c.is_one_shot', '=', params.is_one_shot)
  }

  const dateRangeStart = getDateRangeStart(params.date_range)
  if (dateRangeStart && params.sort !== 'sales') {
    dataQuery = dataQuery.where('c.created_at', '>=', dateRangeStart)
    countQuery = countQuery.where('c.created_at', '>=', dateRangeStart)
  }

  if (params.search) {
    // ilike = case-insensitive LIKE ใน PostgreSQL
    // search_field เลือกได้ว่าค้นจากชื่อเรื่อง (default) หรือชื่อนักเขียน
    const term = `%${params.search}%`
    if (params.search_field === 'author') {
      dataQuery = dataQuery.where('u.display_name', 'ilike', term)
      countQuery = countQuery.where('u.display_name', 'ilike', term)
    } else {
      dataQuery = dataQuery.where('c.title', 'ilike', term)
      countQuery = countQuery.where('c.title', 'ilike', term)
    }
  }

  // ---- Sort ----
  // ทุก sort mode เรียง+ตัดหน้าที่ระดับ SQL ทั้งหมด — 'latest'/'popular' เรียงตรงบนคอลัมน์ของ
  // works เองอยู่แล้ว ส่วน 'likes'/'comments'/'updated'/'sales' ที่ต้องนับ/คำนวณข้าม table
  // ใช้ LEFT JOIN กับ subquery ที่นับ/หาค่าล่วงหน้า (derived table) แล้วให้ ORDER BY + LIMIT/OFFSET
  // ทำงานบน DB ตรงๆ — ไม่ดึงข้อมูลทั้งหมดที่ match filter มา sort ใน JS อีกต่อไป (ของเดิมดึงทั้ง
  // ตารางมาทุกครั้งที่ sort แบบนี้ ไม่ scale พอนิยายเยอะขึ้น — ดู KNOWN_ISSUES.md)
  const dir = params.sort_dir ?? 'desc'

  async function fetchSortedPage() {
    if (params.sort === 'likes') {
      const rows = await dataQuery
        .leftJoin(
          (eb) => eb.selectFrom('work_favorite')
            .select(['p_id', ({ fn }) => fn.countAll<string>().as('cnt')])
            .groupBy('p_id')
            .as('lc'),
          (join) => join.onRef('lc.p_id', '=', 'c.p_id'),
        )
        .orderBy(sql`coalesce(lc.cnt, 0)`, dir)
        // ตัวเลขเสมอกัน (พบบ่อยตอนแทบไม่มีข้อมูลจริง เช่นเพิ่ง migrate) ไม่มี tie-breaker ตัวที่ 2
        // จะได้ลำดับแบบ Postgres สุ่มตาม query plan ไม่ใช่ตามความหมายจริง — ใช้ p_id เป็นตัวตัดสิน
        .orderBy('c.p_id', 'desc')
        .limit(params.limit)
        .offset(offset)
        .execute()
      const counts = await getWorkCounts(rows.map((r) => r.p_id))
      return { rows, counts }
    }

    if (params.sort === 'comments') {
      const rows = await dataQuery
        .leftJoin(
          (eb) => eb.selectFrom('work_comments')
            .select(['work_id', ({ fn }) => fn.countAll<string>().as('cnt')])
            .where('parent_id', 'is', null)
            .where('status', '=', 'active')
            .groupBy('work_id')
            .as('cc'),
          (join) => join.onRef('cc.work_id', '=', 'c.p_id'),
        )
        .orderBy(sql`coalesce(cc.cnt, 0)`, dir)
        .orderBy('c.p_id', 'desc')
        .limit(params.limit)
        .offset(offset)
        .execute()
      const counts = await getWorkCounts(rows.map((r) => r.p_id))
      return { rows, counts }
    }

    if (params.sort === 'sales') {
      // sort=sales: ช่วงเวลาเป็นช่วงเวลาของ "การซื้อ" ไม่ใช่วันที่สร้างเรื่อง จึงจัดอันดับเรื่องเก่า
      // ที่เพิ่งขายดีในสัปดาห์นี้ได้ถูกต้อง — filter ช่วงเวลาต้องอยู่ *ใน* subquery เอง ไม่ใช่ WHERE
      // ต่อท้ายหลัง LEFT JOIN เพราะจะกลายเป็นตัดเรื่องที่ไม่มียอดขายในช่วงนั้นทิ้งไปด้วย (เท่ากับ
      // INNER JOIN เงียบๆ ทั้งที่ตั้งใจให้เรื่องยอดขาย 0 ในช่วงนั้นยังโผล่ท้ายลิสต์อยู่)
      const rows = await dataQuery
        .leftJoin(
          (eb) => {
            let sq = eb.selectFrom('ep_shop').select(['p_id', ({ fn }) => fn.countAll<string>().as('cnt')])
            if (dateRangeStart) sq = sq.where('created_at', '>=', dateRangeStart)
            return sq.groupBy('p_id').as('sc')
          },
          (join) => join.onRef('sc.p_id', '=', 'c.p_id'),
        )
        .orderBy(sql`coalesce(sc.cnt, 0)`, dir)
        // ยอดขายเสมอกัน (0 เท่ากันหมดตอนแทบไม่มีการซื้อจริงในช่วงเวลานั้น) ไม่มี tie-breaker
        // จะได้ลำดับสุ่มตาม query plan ของ Postgres ไม่ใช่ยอดขายจริง — ใช้ p_id ตัดสิน
        .orderBy('c.p_id', 'desc')
        .limit(params.limit)
        .offset(offset)
        .execute()
      const counts = await getWorkCounts(rows.map((r) => r.p_id))
      return { rows, counts }
    }

    if (params.sort === 'updated') {
      // 'updated' — 2026-07-30 มติแก้: เดิมเรียงตาม works.updated_at ตรงๆ ซึ่งขยับได้จากการแก้ไข
      // อะไรก็ได้ (เช่นแก้คำโปรย) ไม่ใช่แค่ "มีเนื้อหาใหม่มาให้อ่าน" จริง — ใช้เวลาที่ตอนล่าสุด
      // "เผยแพร่จริง" ของแต่ละเรื่องแทน: publish ทันที = updated_at ของตอนนั้น (จับจังหวะที่สถานะ
      // เปลี่ยนเป็น publish), ตั้งเวลาไว้ = schedule_datetime เอง (จังหวะที่ถึงเวลาจริง ไม่ใช่ตอน
      // สร้างตอนทิ้งไว้ล่วงหน้า) — เรื่องที่ยังไม่มีตอนเผยแพร่เลย (ไม่มีแถวใน subquery, join ได้
      // NULL) fallback ไปใช้ c.created_at ของตัวเรื่องเองแทนผ่าน coalesce
      const rows = await dataQuery
        .leftJoin(
          (eb) => eb.selectFrom('work_ep')
            .select([
              'p_id',
              sql<Date>`MAX(CASE WHEN publish_status = 'schedule' THEN schedule_datetime ELSE updated_at END)`.as('effective_time'),
            ])
            .where('status', '=', 'active')
            .where((eb2) => eb2.or([
              eb2('publish_status', '=', 'now'),
              eb2.and([eb2('publish_status', '=', 'schedule'), eb2('schedule_datetime', '<=', new Date())]),
            ]))
            .groupBy('p_id')
            .as('lu'),
          (join) => join.onRef('lu.p_id', '=', 'c.p_id'),
        )
        .orderBy(sql`coalesce(lu.effective_time, c.created_at)`, dir)
        .limit(params.limit)
        .offset(offset)
        .execute()
      const counts = await getWorkCounts(rows.map((r) => r.p_id))
      return { rows, counts }
    }

    const sortColumn = params.sort === 'popular' ? 'c.view_count' : 'c.created_at'
    dataQuery = dataQuery.orderBy(sortColumn, dir)
    const rows = await dataQuery.limit(params.limit).offset(offset).execute()
    const counts = await getWorkCounts(rows.map((r) => r.p_id))
    return { rows, counts }
  }

  // ---- รัน query พร้อมกัน (Promise.all เร็วกว่ารัน sequential) ----
  const [{ rows, counts }, countRow] = await Promise.all([
    fetchSortedPage(),
    countQuery.executeTakeFirstOrThrow(),
  ])

  const { episodeCounts, likeCounts, commentCounts } = counts
  const total = Number(countRow.total)

  return {
    data: rows.map((row) => ({
      uuid: row.uuid,
      title: row.title,
      description: row.description,
      cover_image: row.cover_image,
      type: row.type,
      origin_type: row.origin_type,
      age_rate: row.age_rate,
      completion_status: row.completion_status,
      view_count: bigintToString(row.view_count),
      tags: row.tags ?? [],
      episode_count: episodeCounts[String(row.p_id)] ?? 0,
      like_count: likeCounts[String(row.p_id)] ?? 0,
      comment_count: commentCounts[String(row.p_id)] ?? 0,
      // "หมวดหมู่เสริม" = จำนวนแท็กอิสระของเรื่องนี้ (works.tags, migration 004 ตั้งใจออกแบบ
      // ไว้เป็น "หมวดหมู่เสริม" ตั้งแต่แรกอยู่แล้ว) นับจริงแทน hardcode 0 (มติ 2026-07-29)
      extra_category_count: (row.tags ?? []).length,
      featured: row.featured,
      created_at: row.created_at,
      updated_at: row.updated_at,
      author: {
        uuid: row.author_uuid,
        display_name: row.author_display_name,
        user_img: row.author_img,
      },
      category_main: row.category_main_id
        ? { id: bigintToString(row.category_main_id), name: row.category_main_name }
        : null,
      category_sub: row.category_sub_id
        ? { id: bigintToString(row.category_sub_id), name: row.category_sub_name }
        : null,
    })),
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      total_pages: Math.ceil(total / params.limit),
    },
  }
}

// ---- ผลงานของนักเขียนคนหนึ่ง (หน้าโปรไฟล์ — แท็บ "แนะนำ"/"ทั้งหมด") ----
// 2026-07-29 มติแก้: กล่องนี้โชว์นิยายที่เจ้าของโปรไฟล์เผยแพร่เอง (ไม่ใช่ที่เก็บเข้าคลังไว้ตามที่
// เข้าใจผิดตอนแรก — ดู KNOWN_ISSUES.md) เรียก getWorks() ซ้ำ (ได้ pagination/tag-count/
// episode-count ฟรี) แล้ว map ให้แบนราบตรงกับ NovelCardData ที่การ์ดหน้าโปรไฟล์ต้องการ
export async function getAuthorWorks(
  authorId: bigint,
  page: number,
  limit: number,
  featuredOnly = false,
  search?: string,
  sort: 'latest' | 'popular' = 'latest', // แท็บ "ทั้งหมด" หน้าโปรไฟล์ — เรียงล่าสุด/ยอดวิวสูงสุด (2026-07-29 user ขอ)
) {
  const result = await getWorks({
    page,
    limit,
    author_id: authorId,
    featured: featuredOnly || undefined,
    search: search || undefined,
    sort,
  })

  return {
    data: result.data.map((w) => ({
      uuid: w.uuid,
      title: w.title,
      cover_image: w.cover_image,
      author_name: w.author.display_name,
      age_rate: w.age_rate,
      tags: w.tags,
      category_main: w.category_main,
      category_sub: w.category_sub,
      extra_category_count: w.extra_category_count,
      episode_count: w.episode_count,
      view_count: w.view_count,
      like_count: w.like_count,
      is_featured: w.featured,
    })),
    pagination: {
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      pages: result.pagination.total_pages,
    },
  }
}

// ---- GET /works/home-section — 3 แถวหน้าแรก ผสม "นิยายแนะนำ" ที่บูสต์ไว้เข้ากับของจริง ----
// (migration 028, 2026-08-04) section ตรงกับ sort ปกติเป๊ะ (sales/popular/latest) — ผลงานที่ถูก
// บูสต์ไว้ (ยังไม่หมดอายุ) ขึ้นก่อนเสมอตามลำดับที่แอดมินจัดไว้ ตามด้วยผลงานจริงตามลำดับปกติ
// (ตัดตัวที่ซ้ำกับที่บูสต์ไปแล้วออก) — limit รวมขยายเพิ่มเท่าจำนวนที่บูสต์ ("เพิ่ม spare capacity"
// ตามที่ user ขอ) กันไม่ให้ผลงานจริงเรื่องท้ายแถวหลุดจากแถวไปเฉยๆ เพราะมีของบูสต์แทรกเข้ามา
export async function getHomeSection(
  section: 'sales' | 'popular' | 'latest',
  baseLimit: number,
  // 2026-08-17 — เมนู "การแสดงผลเนื้อหา" (หัวใจ navbar) ต้อง filter ทั้งแถวบูสต์และแถว organic
  // เหมือนกัน (ถ้าซ่อน 18+ ไว้ ของบูสต์ก็ต้องไม่โผล่ด้วย ไม่งั้นขัดกับที่ผู้อ่านตั้งใจซ่อนไว้)
  contentPref?: { age_rate?: 'all' | '18+'; tags_all?: string[]; tags_none?: string[] },
) {
  // แถว "เรื่องเด่นประจำสัปดาห์" วัดการซื้อตอนจริงใน 7 วันล่าสุด
  // ไม่ใช้วันที่สร้างผลงานเป็นตัวกรอง เพราะเรื่องเก่าก็ขายดีประจำสัปดาห์ได้
  const dateRange = section === 'sales' ? 'week' : undefined
  const featuredLinks = await db
    .selectFrom('featured_works as f')
    .innerJoin('works as w', 'w.p_id', 'f.p_id')
    .select(['w.uuid'])
    .where('f.section', '=', section)
    .where('f.expires_at', '>=', sql<Date>`now()`)
    .where('w.status', '=', 'active')
    .orderBy('f.sort_order', 'asc')
    .execute()

  const featuredUuids = featuredLinks.map((r) => r.uuid)

  const [featuredResult, organicResult] = await Promise.all([
    featuredUuids.length > 0
      ? getWorks({ page: 1, limit: featuredUuids.length, sort: section, date_range: dateRange, uuids: featuredUuids, ...contentPref })
      : Promise.resolve({ data: [] as Awaited<ReturnType<typeof getWorks>>['data'] }),
    getWorks({
      page: 1,
      limit: baseLimit + featuredUuids.length,
      sort: section,
      date_range: dateRange,
      exclude_uuids: featuredUuids.length > 0 ? featuredUuids : undefined,
      ...contentPref,
    }),
  ])

  // 'in' ไม่การันตีลำดับ — จัดกลับตามลำดับ sort_order ที่แอดมินตั้งไว้ (featuredUuids) เอง
  const byUuid = new Map(featuredResult.data.map((w) => [w.uuid, w]))
  const orderedFeatured = featuredUuids.map((u) => byUuid.get(u)).filter((w): w is NonNullable<typeof w> => Boolean(w))

  return {
    data: [...orderedFeatured, ...organicResult.data].slice(0, baseLimit + featuredUuids.length),
  }
}

// ---- GET /works/:uuid ----
// ดึงรายละเอียดผลงาน + รายการตอนที่ publish แล้ว

export async function getWorkByUuid(uuid: string, userId: bigint | null = null) {
  // ---- Step 1: ดึงข้อมูลผลงาน ----
  const work = await db
    .selectFrom('works as c')
    .innerJoin('users as u', 'u.id', 'c.author_id')
    .leftJoin('categories as cm', 'cm.id', 'c.category_main')
    .leftJoin('categories as cs', 'cs.id', 'c.category_sub')
    .select([
      'c.p_id',       // ใช้ในการ query episodes ต่อ
      'c.uuid',
      'c.title',
      'c.description',
      'c.synopsis',
      'c.tags',
      'c.cover_image',
      'c.type',
      'c.origin_type',
      'c.age_rate',
      'c.completion_status',
      'c.view_count',
      'c.created_at',
      'c.updated_at',
      'u.uuid as author_uuid',
      'u.u_name as author_u_name',
      'u.display_name as author_display_name',
      'u.user_img as author_img',
      'cm.id as category_main_id',
      'cm.name as category_main_name',
      'cs.id as category_sub_id',
      'cs.name as category_sub_name',
    ])
    .where('c.uuid', '=', uuid)
    .where('c.publish_status', '=', 1)
    .where('c.status', '=', 'active')
    .where('c.deleted_at', 'is', null)
    .where('c.banned', 'is', null)
    .executeTakeFirst()

  // ถ้าไม่เจอ หรือ ไม่ตรงเงื่อนไข return null → routes จะ 404 เอง
  if (!work) return null

  // ---- Step 1b: หัวใจ (like) + เก็บเข้าคลัง (bookmark) + คอมเม้น ----
  // "หัวใจ" ใช้ work_favorite ตามมติ 2026-07-12 (นับจำนวนคนกด ไม่ใช่ระบบให้ดาว)
  // "เก็บเข้าคลัง" ใช้ work_bookmarks (migration 009) — แยกตารางจาก work_favorite
  // จริงจัง เพราะ "ชอบ" กับ "ตั้งใจเก็บไว้อ่านทีหลัง" เป็นคนละความหมายกัน
  const [likeCountRow, commentCountRow, likedRow, bookmarkCountRow, bookmarkedRow] = await Promise.all([
    db
      .selectFrom('work_favorite')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('p_id', '=', work.p_id)
      .executeTakeFirst(),
    db
      .selectFrom('work_comments')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('work_id', '=', work.p_id)
      .where('parent_id', 'is', null)
      .where('status', '=', 'active')
      .executeTakeFirst(),
    userId
      ? db
          .selectFrom('work_favorite')
          .select('id')
          .where('p_id', '=', work.p_id)
          .where('user_id', '=', userId)
          .executeTakeFirst()
      : Promise.resolve(undefined),
    db
      .selectFrom('work_bookmarks')
      .select(({ fn }) => fn.countAll<string>().as('count'))
      .where('p_id', '=', work.p_id)
      .executeTakeFirst(),
    userId
      ? db
          .selectFrom('work_bookmarks')
          .select('id')
          .where('p_id', '=', work.p_id)
          .where('user_id', '=', userId)
          .executeTakeFirst()
      : Promise.resolve(undefined),
  ])

  // ---- Step 2: ดึง episodes ที่ publish แล้ว ----
  // เงื่อนไข:
  //   publish_status = 'now'  → publish ทันที
  //   publish_status = 'schedule' AND schedule_datetime <= NOW()  → ถึงเวลาแล้ว
  // ไม่แสดง 'hide' และ schedule ที่ยังไม่ถึงเวลา

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
      'episode_label',
      'created_at',
      'updated_at',
    ])
    .where('p_id', '=', work.p_id)
    .where('status', '=', 'active')
    .where((eb) =>
      eb.or([
        // ตอนที่ publish ทันที
        eb('publish_status', '=', 'now'),
        // ตอนที่ schedule ไว้ และถึงเวลาแล้ว
        eb.and([
          eb('publish_status', '=', 'schedule'),
          eb('schedule_datetime', '<=', new Date()),
        ]),
      ])
    )
    .orderBy('ep_no', 'asc')   // เรียงตอนจากน้อยไปมาก
    .execute()

  // ---- Step 2.5: is_purchased/is_read ต่อตอน เฉพาะ user ที่ login (2026-08-05, ใหม่) ----
  // ใช้โชว์สัญลักษณ์ในสารบัญ (ซื้อแล้ว/อ่านแล้ว) + เช็คก่อนพาไปหน้าตอนที่ล็อกไว้โดยไม่ต้อง
  // navigate ไปก่อนแล้วค่อยเจอ error (ดู episode-reader-client.tsx ฝั่ง frontend)
  let purchasedEpIds = new Set<string>()
  let readEpNos = new Set<number>()
  if (userId && episodes.length > 0) {
    const epIds = episodes.map((ep) => ep.ep_id)
    const [purchasedRows, readRows] = await Promise.all([
      db
        .selectFrom('ep_shop')
        .select('ep_id')
        .where('user_id', '=', userId)
        .where('ep_id', 'in', epIds)
        .where((eb) => eb.or([eb('lock_after_datetime', 'is', null), eb('lock_after_datetime', '>', new Date())]))
        .execute(),
      db
        .selectFrom('work_ep_views')
        .select('ep_no')
        .distinct()
        .where('user_id', '=', userId)
        .where('p_id', '=', work.p_id)
        .execute(),
    ])
    purchasedEpIds = new Set(purchasedRows.map((r) => String(r.ep_id)))
    readEpNos = new Set(readRows.map((r) => r.ep_no))
  }

  // ---- Step 3: แปลง episodes เป็น response format ----
  // migration 014 — episode_label ย้ายมาเป็นค่าต่อตอนแล้ว (ไม่ใช่ค่าเดียวทั้งเรื่องอีกต่อไป)
  const formattedEpisodes = episodes.map((ep) => ({
    ep_id: bigintToString(ep.ep_id),
    ep_name: ep.ep_name,
    ep_no: ep.ep_no,
    ep_price: ep.ep_price,            // string (NUMERIC) — ส่งออกเป็น string ไว้แล้ว
    is_free: Number(ep.ep_price) === 0,
    is_purchased: purchasedEpIds.has(String(ep.ep_id)),
    is_read: readEpNos.has(ep.ep_no),
    lock_duration_days: ep.lock_duration_days,
    total_image: ep.total_image,
    episode_label: ep.episode_label,
    created_at: ep.created_at,
    updated_at: ep.updated_at,
  }))

  return {
    uuid: work.uuid,
    title: work.title,
    description: work.description,
    synopsis: work.synopsis,
    tags: work.tags,
    cover_image: work.cover_image,
    type: work.type,
    origin_type: work.origin_type,
    age_rate: work.age_rate,
    completion_status: work.completion_status,
    view_count: bigintToString(work.view_count),
    like_count: Number(likeCountRow?.count ?? 0),
    is_liked: Boolean(likedRow),
    comment_count: Number(commentCountRow?.count ?? 0),
    bookmark_count: Number(bookmarkCountRow?.count ?? 0),
    is_bookmarked: Boolean(bookmarkedRow),
    created_at: work.created_at,
    updated_at: work.updated_at,
    author: {
      uuid: work.author_uuid,
      u_name: work.author_u_name,
      display_name: work.author_display_name,
      user_img: work.author_img,
    },
    category_main: work.category_main_id
      ? { id: bigintToString(work.category_main_id), name: work.category_main_name }
      : null,
    category_sub: work.category_sub_id
      ? { id: bigintToString(work.category_sub_id), name: work.category_sub_name }
      : null,
    episodes: formattedEpisodes,
    episode_count: formattedEpisodes.length,
    free_episode_count: formattedEpisodes.filter((ep) => ep.is_free).length,
  }
}

// ---- GET /works/:uuid/episodes/:ep_no/read ----
// อ่านเนื้อหาจริงของตอน
//
// Logic หลัก:
//   1. หาผลงานและตอนให้เจอก่อน
//   2. เช็คสิทธิ์ — ฟรี? ซื้อแล้ว? ยังไม่ซื้อ?
//   3. แยก response ตาม type: manga → images, novel → blocks
//   4. เพิ่ม view_count ให้ผลงาน

export type EpisodeContentError =
  | 'WORK_NOT_FOUND'
  | 'EPISODE_NOT_FOUND'
  | 'LOGIN_REQUIRED'    // ต้องล็อกอินก่อน (ตอนไม่ฟรี)
  | 'PURCHASE_REQUIRED' // ล็อกอินแล้วแต่ยังไม่ซื้อ

export async function getEpisodeContent(
  workUuid: string,
  epNo: number,
  userId: bigint | null  // null = guest ที่ยังไม่ล็อกอิน
): Promise<{ error: EpisodeContentError } | object> {

  // ---- Step 1: หาผลงาน ----
  const work = await db
    .selectFrom('works')
    .select(['p_id', 'type', 'uuid', 'title'])
    .where('uuid', '=', workUuid)
    .where('publish_status', '=', 1)
    .where('status', '=', 'active')
    .where('deleted_at', 'is', null)
    .where('banned', 'is', null)
    .executeTakeFirst()

  if (!work) return { error: 'WORK_NOT_FOUND' }

  // ---- Step 2: หาตอน ----
  // เช็คทั้ง publish_status = 'now' และ schedule ที่ถึงเวลาแล้ว
  const episode = await db
    .selectFrom('work_ep')
    .selectAll()
    .where('p_id', '=', work.p_id)
    .where('ep_no', '=', epNo)
    .where('status', '=', 'active')
    .where((eb) =>
      eb.or([
        eb('publish_status', '=', 'now'),
        eb.and([
          eb('publish_status', '=', 'schedule'),
          eb('schedule_datetime', '<=', new Date()),
        ]),
      ])
    )
    .executeTakeFirst()

  if (!episode) return { error: 'EPISODE_NOT_FOUND' }

  // ---- Step 3: เช็คสิทธิ์การเข้าถึง ----
  const isFree = Number(episode.ep_price) === 0

  if (!isFree) {
    // ตอนที่ต้องซื้อ — ต้องล็อกอินก่อน
    if (!userId) return { error: 'LOGIN_REQUIRED' }

    // เช็คว่าซื้อแล้วและยังไม่หมดอายุ
    // lock_after_datetime = null → ซื้อถาวร ใช้ได้เสมอ
    // lock_after_datetime > now() → ยังไม่หมดอายุ ใช้ได้
    const purchase = await db
      .selectFrom('ep_shop')
      .select('id')
      .where('user_id', '=', userId)
      .where('ep_id', '=', episode.ep_id)
      .where((eb) =>
        eb.or([
          eb('lock_after_datetime', 'is', null),
          eb('lock_after_datetime', '>', new Date()),
        ])
      )
      .executeTakeFirst()

    if (!purchase) return { error: 'PURCHASE_REQUIRED' }
  }

  // ---- Step 4: เพิ่ม view_count ----
  // ทำแบบ atomic — ไม่ต้องกังวล race condition เพราะเป็น SQL expression ไม่ใช่ read-then-write
  await db
    .updateTable('works')
    .set({ view_count: sql<bigint>`view_count + 1` })
    .where('p_id', '=', work.p_id)
    .execute()

  // ---- Step 4.5: บันทึกลง work_ep_views ----
  // 2026-08-05 (แก้): เดิม insert เฉพาะ user ที่ login เท่านั้น เหตุผลตอนนั้นคือ "guest ไม่มีหน้า
  // ประวัติให้ดูอยู่แล้ว" — แต่ตอนนี้ตารางนี้ถูกใช้เป็นแหล่งข้อมูลกราฟยอดวิว (แดชบอร์ด/สถิติเจาะลึก)
  // ด้วยแล้ว ซึ่งต้องนับ guest รวมด้วยถึงจะใกล้เคียงยอดวิวจริง (works.view_count) — user ยืนยันว่า
  // "แค่เอาไว้แสดงบนหน้าเว็บเฉยๆ นับซ้ำได้" คือไม่ต้องกัน dedupe/ยืนยันตัวตน guest ให้แน่นหนา
  // insert ทุกครั้งที่อ่านเหมือนเดิม (user_id เป็น null สำหรับ guest โดยธรรมชาติ — getReadingHistory/
  // getRecentlyReadFeed ใน social.service.ts กรอง user_id = :userId ตรงๆ อยู่แล้ว แถว guest เลย
  // ไม่มีทางหลุดไปปนในหน้าประวัติของใครเลย)
  await db
    .insertInto('work_ep_views')
    .values({ p_id: work.p_id, ep_no: epNo, user_id: userId, ip_address: null })
    .execute()

  // ---- Step 4.6: เช็คว่าตอนนี้ถูก "บันทึกไว้ดูทีหลัง" ไหม (migration 023, คนละอันกับ
  // work_bookmarks ทั้งเรื่อง) — inline ตรงนี้แทนเรียกจาก social.service.ts เพราะ social.service.ts
  // import getWorks() จากไฟล์นี้อยู่แล้ว (import กลับไปจะเกิด circular import)
  const isEpBookmarked = userId
    ? Boolean(
        await db
          .selectFrom('work_ep_bookmarks')
          .select('id')
          .where('user_id', '=', userId)
          .where('ep_id', '=', episode.ep_id)
          .executeTakeFirst()
      )
    : false

  // ---- Step 5: return content ตาม type ----
  const baseEpisode = {
    ep_id:             bigintToString(episode.ep_id),
    ep_name:           episode.ep_name,
    ep_no:             episode.ep_no,
    ep_price:          episode.ep_price,
    is_free:           isFree,
    lock_duration_days: episode.lock_duration_days,
    reader_message:    episode.reader_message,
    episode_label:     episode.episode_label, // migration 014 — ค่าต่อตอนแล้ว
    is_ep_bookmarked:  isEpBookmarked,
  }

  if (work.type === 'manga') {
    // manga → ดึงรูปภาพทั้งหมดของตอนนี้ เรียงตาม sort_order
    const images = await db
      .selectFrom('work_ep_image')
      .select(['image_path', 'sort_order'])
      .where('ep_id', '=', episode.ep_id)
      .orderBy('sort_order', 'asc')
      .execute()

    return {
      type: 'manga' as const,
      work: { uuid: work.uuid, title: work.title },
      episode: baseEpisode,
      images,  // [{ image_path: "r2/...", sort_order: 0 }, ...]
    }
  } else {
    // novel → return blocks จาก ep_content JSONB
    // ep_content อาจเป็น null ถ้ายังไม่มีเนื้อหา → คืน array ว่าง
    const blocks = episode.ep_content ?? []
    const audio = await getEpisodeAudioForBlocks(episode.ep_id, blocks)
    return {
      type: 'novel' as const,
      work: { uuid: work.uuid, title: work.title },
      episode: baseEpisode,
      blocks,
      audio,
    }
  }
}

// ---- GET /categories ----
// ดึง categories ทั้งหมดที่ active — แนบ work_count (จำนวนนิยายที่ตั้ง category_main เป็นหมวดนี้
// เฉพาะที่มองเห็นได้จริงฝั่งสาธารณะ — publish_status/status/deleted_at/banned เงื่อนไขเดียวกับ
// getWorks() ด้านล่าง) มาด้วย ให้ฝั่ง frontend เอาไปเรียงตามความนิยมได้เอง (เช่น แถบหมวดหมู่
// หน้าแรก) — ไม่เปลี่ยน order เริ่มต้น (ยัง alphabetical เหมือนเดิม) เพราะฟอร์มเขียนนิยาย/
// dropdown หน้า search ก็ใช้ endpoint นี้อยู่ ไม่อยากเปลี่ยนพฤติกรรมที่นั่น
export async function getCategories() {
  const rows = await db
    .selectFrom('categories as cat')
    .leftJoin('works as w', (join) =>
      join
        .onRef('w.category_main', '=', 'cat.id')
        .on('w.publish_status', '=', 1)
        .on('w.status', '=', 'active')
        .on('w.deleted_at', 'is', null)
        .on('w.banned', 'is', null)
    )
    .select(({ fn }) => ['cat.id', 'cat.name', 'cat.icon', fn.count<string>('w.p_id').as('work_count')])
    .where('cat.status', '=', true)
    .groupBy(['cat.id', 'cat.name', 'cat.icon'])
    .orderBy('cat.name', 'asc')
    .execute()

  // แปลง bigint id → string ก่อนส่งออก
  return rows.map((row) => ({
    id: bigintToString(row.id),
    name: row.name,
    icon: row.icon,
    work_count: Number(row.work_count),
  }))
}

// =============================================================
// Category Admin Management (migration 049) — CRUD ผ่านหน้าแอดมิน แทนแก้ SQL ตรงๆ เหมือนเดิม
// gate ด้วย content.categories.manage ใน permission matrix (ดู admin.routes.ts)
// =============================================================

// ---- GET /admin/categories — เหมือน getCategories() แต่ไม่กรอง status (โชว์ที่ปิดไว้ด้วย) ----
export async function getCategoriesAdmin() {
  const rows = await db
    .selectFrom('categories as cat')
    .leftJoin('works as w', (join) =>
      join
        .onRef('w.category_main', '=', 'cat.id')
        .on('w.publish_status', '=', 1)
        .on('w.status', '=', 'active')
        .on('w.deleted_at', 'is', null)
        .on('w.banned', 'is', null)
    )
    .select(({ fn }) => ['cat.id', 'cat.name', 'cat.icon', 'cat.status', fn.count<string>('w.p_id').as('work_count')])
    .groupBy(['cat.id', 'cat.name', 'cat.icon', 'cat.status'])
    .orderBy('cat.name', 'asc')
    .execute()

  return rows.map((row) => ({
    id: bigintToString(row.id),
    name: row.name,
    icon: row.icon,
    status: row.status,
    work_count: Number(row.work_count),
  }))
}

// ---- POST /admin/categories ----
export async function createCategory(name: string, icon: string | null) {
  try {
    const row = await db
      .insertInto('categories')
      .values({ name, icon, status: true })
      .returning(['id', 'name', 'icon', 'status'])
      .executeTakeFirstOrThrow()
    return { id: bigintToString(row.id), name: row.name, icon: row.icon, status: row.status, work_count: 0 }
  } catch (err: any) {
    if (err.code === '23505') throw new Error('CATEGORY_NAME_TAKEN') // unique violation (categories.name)
    throw err
  }
}

// ---- PATCH /admin/categories/:id — เปลี่ยนชื่อ/ไอคอน/เปิดปิดการมองเห็น (partial) ----
export async function updateCategory(id: bigint, patch: { name?: string; icon?: string | null; status?: boolean }) {
  const existing = await db.selectFrom('categories').select('id').where('id', '=', id).executeTakeFirst()
  if (!existing) throw new Error('CATEGORY_NOT_FOUND')

  try {
    await db.updateTable('categories').set(patch).where('id', '=', id).execute()
  } catch (err: any) {
    if (err.code === '23505') throw new Error('CATEGORY_NAME_TAKEN')
    throw err
  }
}

// ---- DELETE /admin/categories/:id — DB บล็อกเองถ้ายังมีนิยายอ้างอิงอยู่ (FK, ไม่มี CASCADE) —
// เช็คนับล่วงหน้าก่อนเพื่อโชว์ error ที่อ่านรู้เรื่อง แทนให้ Postgres โยน FK violation ดิบๆ ออกไป ----
export async function deleteCategory(id: bigint) {
  const existing = await db.selectFrom('categories').select('id').where('id', '=', id).executeTakeFirst()
  if (!existing) throw new Error('CATEGORY_NOT_FOUND')

  const usedRow = await db
    .selectFrom('works')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where((eb) => eb.or([eb('category_main', '=', id), eb('category_sub', '=', id)]))
    .executeTakeFirstOrThrow()
  if (Number(usedRow.total) > 0) throw new Error('CATEGORY_IN_USE')

  await db.deleteFrom('categories').where('id', '=', id).execute()
}

// ---- GET /tags ----
// แนะนำหมวดหมู่ย่อย (tags) แบบ autocomplete พร้อมจำนวนเรื่องที่ใช้ — คล้าย hashtag TikTok:
// พิมพ์อะไรก็ตั้งเป็น tag ใหม่ได้เสมอ (works.tags ยังเป็น free text array ตามเดิม ไม่ผูกกับ
// ตารางคงที่แบบ categories) — ตั้งแต่ migration 017 มีตาราง tags/work_tags เป็น registry
// คู่ขนานคอย track ว่า tag ไหนสร้างเมื่อไหร่/ใครสร้าง/ถูกใช้กี่เรื่อง (สำหรับโควต้าสร้าง tag
// ใหม่ + ลบ tag ขยะ ดู syncWorkTags() ใน writer.service.ts) จึงอ่าน count จากตารางนี้แทน
// unnest(works.tags) เดิม (index-backed แทน full sequential scan)

const STALE_TAG_DAYS = 30
const STALE_TAG_MIN_WRITERS = 3 // tag รอดถ้ามีนักเขียน distinct ใช้อยู่มากกว่านี้

// ลบ tag ที่แก่เกิน 30 วันแล้วยังมีนักเขียน distinct ใช้ไม่เกิน 3 คน (2026-07-27 user ขอ
// กันเก็บ tag ขยะที่ไม่มีใครใช้จริงไว้ตลอดกาล) — เรียกแบบ "lazy" ตอนมีคนเปิด popover แนะนำ
// tag เอา (ยังไม่มี cron/queue job ในโปรเจกต์นี้ ดู KNOWN_ISSUES.md — ฟีเจอร์นี้เบามาก
// พอสำหรับวิธีนี้ไปก่อน) เรียกเฉพาะตอนไม่มี search term (แค่ตอนเปิด popover ครั้งแรก)
// กันไม่ให้รัน DELETE ซ้ำทุกครั้งที่พิมพ์ค้นหา
async function cleanupStaleTags() {
  await sql`
    DELETE FROM tags
    WHERE created_at <= now() - make_interval(days => ${STALE_TAG_DAYS})
      AND id NOT IN (
        SELECT tag_id FROM work_tags
        GROUP BY tag_id
        HAVING COUNT(DISTINCT author_id) > ${STALE_TAG_MIN_WRITERS}
      )
  `.execute(db)
}

export async function getTagSuggestions(search: string | undefined, limit: number) {
  const trimmed = search?.trim()

  if (!trimmed) await cleanupStaleTags()

  let query = db
    .selectFrom('tags as t')
    .innerJoin('work_tags as wt', 'wt.tag_id', 't.id')
    .innerJoin('works as w', (join) =>
      join
        .onRef('w.p_id', '=', 'wt.p_id')
        .on('w.status', '=', 'active')
        .on('w.publish_status', '=', 1)
    )
    .select(['t.name'])
    .select(({ fn }) => fn.count<string>('wt.p_id').distinct().as('count'))
    .groupBy('t.name')

  if (trimmed) query = query.where('t.name', 'ilike', `%${trimmed}%`)

  const result = await query
    .orderBy('count', 'desc')
    .orderBy('t.name', 'asc')
    .limit(limit)
    .execute()

  return result.map((r) => ({ name: r.name, count: Number(r.count) }))
}

// ---- GET /carousels ----
// รูปโปรโมต Hero banner หน้าแรก — คนละเรื่องกับ "นิยาย" (ไม่มี CRUD/admin ให้จัดการ
// ผ่าน UI ตอนนี้ ต้องเพิ่ม/แก้แถวผ่าน SQL ตรงๆ ไปก่อน — ดู KNOWN_ISSUES.md)

// ---- ช่องทางติดต่อ/โซเชียลของเว็บ (Footer + หน้า "ติดต่อแอดมิน") ----
// ตาราง web_contacts มีมาตั้งแต่ migration 001 แต่ไม่เคยมี service/route ไหนอ่านเลยสักครั้ง
// (ของค้างจาก schema เดิม) — 2026-07-30 เอามาต่อจริงตอนทำ Footer เพราะ shape (label/url/icon_class)
// ตรงกับที่ต้องใช้พอดี ว่างเปล่าได้ปกติ — ฝั่ง frontend ซ่อน section นี้ถ้าไม่มีข้อมูล
// 2026-08-18 (migration 054): เพิ่ม admin CRUD จริงแล้ว (ดู admin-contact-page.service.ts) —
// เลยกรองเฉพาะ status=true (แอดมินซ่อนแถวไหนไว้ ไม่ต้องลบถาวร) + เรียงตาม sort_order ที่แอดมินตั้งได้
export async function getWebContacts() {
  const rows = await db
    .selectFrom('web_contacts')
    .select(['id', 'label', 'url', 'icon_class'])
    .where('status', '=', true)
    .orderBy('sort_order', 'asc')
    .orderBy('id', 'asc')
    .execute()

  return rows.map((row) => ({
    id: bigintToString(row.id),
    label: row.label,
    url: row.url,
    icon_class: row.icon_class,
  }))
}

// ---- คำถามที่พบบ่อย (หน้า "ติดต่อแอดมิน") ---- (migration 054, ใหม่)
export async function getFaqs() {
  const rows = await db
    .selectFrom('faqs')
    .select(['id', 'question', 'answer'])
    .where('status', '=', true)
    .orderBy('sort_order', 'asc')
    .orderBy('id', 'asc')
    .execute()

  return rows.map((row) => ({
    id: bigintToString(row.id),
    question: row.question,
    answer: row.answer,
  }))
}

// ---- แถบประกาศแอดมิน (เหนือ/ใต้ Hero Carousel หน้าแรก) ----
// ตาราง announcements + CRUD ฝั่งแอดมิน (level >= 9, /admin/announcements) มีอยู่แล้วตั้งแต่
// migration 001 — เดิมมีแค่ /writer/announcements (ต้อง login เป็นนักเขียน) ใช้ไม่ได้กับผู้ชม
// ทั่วไปที่ยังไม่ login เอ็นด์พอยต์นี้เปิด public เอาไว้เฉพาะอ่าน (status='active') สำหรับหน้าแรก
export async function getActiveAnnouncements() {
  const rows = await db
    .selectFrom('announcements')
    .select(['id', 'title', 'content', 'color'])
    .where('status', '=', 'active')
    .orderBy('created_at', 'desc')
    .execute()

  return rows.map((row) => ({
    id: bigintToString(row.id),
    title: row.title,
    content: row.content,
    color: row.color,
  }))
}

// 2026-08-04: กรองตามตั้งเวลาเผยแพร่/สิ้นสุดด้วย (migration 028) — ก่อนหน้านี้แค่ status='active'
// เพียวๆ ไม่มีมิติเวลาเลย ตอนนี้ carousel ที่ตั้ง start_at ไว้ล่วงหน้ายังไม่ถึงเวลา หรือ end_at
// ผ่านไปแล้ว จะไม่โผล่ฝั่งสาธารณะ (ไม่มี cron ในโปรเจกต์นี้ — กรองแบบ query-time ตรงนี้เลย)
export async function getCarousels() {
  const rows = await db
    .selectFrom('carousels')
    .select(['id', 'title', 'subtitle', 'image_path', 'link_url', 'display_seconds'])
    .where('status', '=', 'active')
    .where('start_at', '<=', sql<Date>`now()`)
    .where((eb) => eb.or([eb('end_at', 'is', null), eb('end_at', '>=', sql<Date>`now()`)]))
    .orderBy('sort_order', 'asc')
    .execute()

  return rows.map((row) => ({
    id: bigintToString(row.id),
    title: row.title,
    subtitle: row.subtitle,
    image_path: row.image_path,
    link_url: row.link_url,
    display_seconds: Number(row.display_seconds),
  }))
}
