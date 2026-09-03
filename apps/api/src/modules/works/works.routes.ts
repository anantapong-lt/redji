// =============================================================
// Novel Platform — Works Routes
// วางไว้ที่: apps/api/src/modules/works/works.routes.ts
// =============================================================

import Elysia, { t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { accountRateLimitRule, enforceRateLimit, ipRateLimitRule } from '../../lib/rate-limit'
import { getWorks, getWorkByUuid, getCategories, getTagSuggestions, getCarousels, getWebContacts, getFaqs, getActiveAnnouncements, getEpisodeContent, getHomeSection } from './works.service'
import { getComments, createComment } from '../social/social.service'

// ---- Works Routes (/works) ----

export const worksRoutes = new Elysia({ prefix: '/works' })
  // เพิ่ม jwt plugin เพื่อให้ reading endpoint อ่าน token ได้
  // ทำไมไม่ใช้ authMiddleware? เพราะ authMiddleware บังคับต้อง login
  // reading endpoint นี้ "optional auth" — ไม่ login ก็อ่านตอนฟรีได้
  .use(jwt({ name: 'jwt', secret: process.env.JWT_SECRET! }))
  // --------------------------------------------------
  // GET /works
  // ดึงรายการผลงานแบบ paginated
  //
  // Query params:
  //   page        — หน้าที่ต้องการ (default: 1)
  //   limit       — จำนวนต่อหน้า (default: 20, max: 50)
  //   type        — 'manga' | 'novel' (optional)
  //   category_id — ID ของ category (optional)
  //   sort        — 'latest' | 'popular' | 'likes' | 'comments' (default: 'latest')
  //   search      — ค้นหาตามชื่อเรื่อง (optional)
  // --------------------------------------------------
  .get(
    '/',
    async ({ query }) => {
      const result = await getWorks({
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        type: query.type as 'manga' | 'novel' | undefined,
        category_id: query.category_id ? BigInt(query.category_id) : undefined,
        category_main_id: query.category_main_id ? BigInt(query.category_main_id) : undefined,
        category_sub_id: query.category_sub_id ? BigInt(query.category_sub_id) : undefined,
        tags: query.tags ? query.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        tags_all: query.tags_all ? query.tags_all.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        tags_none: query.tags_none ? query.tags_none.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        completion_status: query.completion_status,
        date_range: query.date_range,
        age_rate: query.age_rate,
        is_one_shot: query.is_one_shot,
        sort: (query.sort as 'latest' | 'popular' | 'likes' | 'comments' | 'updated' | 'sales') ?? 'latest',
        sort_dir: query.sort_dir,
        search: query.search,
        search_field: query.search_field,
      })
      return { success: true, ...result }
    },
    {
      query: t.Object({
        page:              t.Optional(t.Numeric({ minimum: 1 })),
        limit:             t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
        type:              t.Optional(t.Union([t.Literal('manga'), t.Literal('novel')])),
        category_id:       t.Optional(t.String()),
        category_main_id:  t.Optional(t.String()),
        category_sub_id:   t.Optional(t.String()),
        tags:              t.Optional(t.String()),  // comma-separated
        // 2026-08-17 — เมนู "การแสดงผลเนื้อหา" (หัวใจ navbar): tags_all = ต้องมีครบทุก tag (โหมด
        // "เฉพาะ BL"/"เฉพาะ GL"), tags_none = ต้องไม่มี tag ไหนเลย (โหมด "ซ่อน BL"/"ซ่อน GL")
        tags_all:          t.Optional(t.String()),  // comma-separated
        tags_none:         t.Optional(t.String()),  // comma-separated
        completion_status: t.Optional(t.Union([t.Literal('ongoing'), t.Literal('completed'), t.Literal('hiatus')])),
        date_range:        t.Optional(t.Union([t.Literal('today'), t.Literal('week'), t.Literal('month'), t.Literal('year')])),
        age_rate:          t.Optional(t.Union([t.Literal('all'), t.Literal('18+')])),
        is_one_shot:       t.Optional(t.Boolean()),
        sort:              t.Optional(t.Union([t.Literal('latest'), t.Literal('popular'), t.Literal('likes'), t.Literal('comments'), t.Literal('updated'), t.Literal('sales')])),
        sort_dir:          t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
        search:            t.Optional(t.String({ maxLength: 100 })),
        search_field:      t.Optional(t.Union([t.Literal('title'), t.Literal('author')])),
      }),
      detail: {
        summary: 'รายการผลงาน (manga/novel) — รองรับ filter/sort ครบสำหรับหน้า /search',
        tags: ['Works'],
      },
    }
  )

  // --------------------------------------------------
  // GET /works/home-section
  // 3 แถวหน้าแรก (sales/popular/latest) ผสม "นิยายแนะนำ" ที่แอดมินบูสต์ไว้เข้ากับของจริง —
  // mount ก่อน /:uuid (static ก่อน dynamic เสมอ กัน "home-section" โดน parse เป็น uuid)
  // 2026-08-04 ใหม่ — ดู getHomeSection() ใน works.service.ts
  // --------------------------------------------------
  .get(
    '/home-section',
    async ({ query }) => {
      const result = await getHomeSection(query.section, query.limit ?? 12, {
        age_rate: query.age_rate,
        tags_all: query.tags_all ? query.tags_all.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
        tags_none: query.tags_none ? query.tags_none.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
      })
      return { success: true, ...result }
    },
    {
      query: t.Object({
        section: t.Union([t.Literal('sales'), t.Literal('popular'), t.Literal('latest')]),
        limit:   t.Optional(t.Numeric({ minimum: 1, maximum: 30 })),
        // 2026-08-17 — เมนู "การแสดงผลเนื้อหา" (หัวใจ navbar), ความหมายเดียวกับที่ GET /works รับ
        age_rate:  t.Optional(t.Union([t.Literal('all'), t.Literal('18+')])),
        tags_all:  t.Optional(t.String()),
        tags_none: t.Optional(t.String()),
      }),
      detail: {
        summary: '3 แถวหน้าแรก ผสม "นิยายแนะนำ" ที่บูสต์ไว้ (ไม่ใช้ /works ตรงๆ กันกระทบหน้า /search)',
        tags: ['Works'],
      },
    }
  )

  // --------------------------------------------------
  // GET /works/:uuid
  // ดึงรายละเอียดผลงาน + รายการตอนที่ publish แล้ว
  // --------------------------------------------------
  .get(
    '/:uuid',
    async ({ params, headers, set, jwt }) => {
      // ---- Optional Auth ---- (เหมือน /:uuid/episodes/:ep_no/read ด้านล่าง)
      // เพื่อรู้ is_liked ของคนที่ล็อกอินอยู่ ถ้ามี — ไม่ล็อกอินก็ดูผลงานได้ปกติ
      let userId: bigint | null = null
      const authorization = headers.authorization
      if (authorization?.startsWith('Bearer ')) {
        const token = authorization.slice(7)
        const payload = await jwt.verify(token)
        if (payload && payload.sub) {
          userId = BigInt(payload.sub as string)
        }
      }

      const work = await getWorkByUuid(params.uuid, userId)

      if (!work) {
        set.status = 404
        return { success: false, message: 'ไม่พบผลงานนี้' }
      }

      return { success: true, data: work }
    },
    {
      params: t.Object({
        uuid: t.String(),
      }),
      detail: {
        summary: 'รายละเอียดผลงาน + รายการตอน',
        tags: ['Works'],
      },
    }
  )

  // --------------------------------------------------
  // GET /works/:uuid/episodes/:ep_no/read
  // อ่านเนื้อหาจริงของตอน
  //
  // ไม่บังคับ login — แต่ถ้าตอนต้องซื้อ จะเช็ค token เอง
  // manga  → ได้ images array กลับมา
  // novel  → ได้ blocks array (NovelBlock[]) กลับมา
  // --------------------------------------------------
  .get(
    '/:uuid/episodes/:ep_no/read',
    async ({ params, headers, set, jwt }) => {
      // 2026-08-05 บั๊กจริงที่ user เจอ: ตอนที่เคยฟรีตอนทดสอบ พอนักเขียนมาตั้งราคาทีหลัง เบราว์เซอร์
      // ดันเสิร์ฟเนื้อหาเก่าที่ cache ไว้ตอนยังฟรีอยู่แทนที่จะเช็คสิทธิ์ซื้อใหม่ — endpoint นี้ผลลัพธ์
      // เปลี่ยนได้ตลอดเวลาตามสิทธิ์การซื้อ ห้าม cache เด็ดขาด (แก้คู่กับฝั่ง frontend ที่ใส่
      // cache:'no-store' ใน fetch เองด้วยแล้ว อันนี้กันชั้นเซิร์ฟเวอร์ไว้อีกชั้น)
      set.headers['Cache-Control'] = 'no-store'

      // ---- Optional Auth ----
      // พยายาม verify token ถ้ามี แต่ไม่บังคับ
      // ถ้าไม่มี token หรือ token ผิด → userId = null (guest)
      let userId: bigint | null = null
      const authorization = headers.authorization
      if (authorization?.startsWith('Bearer ')) {
        const token = authorization.slice(7)
        const payload = await jwt.verify(token)
        if (payload && payload.sub) {
          userId = BigInt(payload.sub as string)
        }
      }

      const result = await getEpisodeContent(params.uuid, params.ep_no, userId)

      // ถ้า result มี field 'error' แสดงว่าเกิด error
      if ('error' in result) {
        switch (result.error) {
          case 'WORK_NOT_FOUND':
          case 'EPISODE_NOT_FOUND':
            set.status = 404
            return { success: false, message: 'ไม่พบเนื้อหานี้' }
          case 'LOGIN_REQUIRED':
            set.status = 401
            return { success: false, message: 'กรุณาล็อกอินก่อน' }
          case 'PURCHASE_REQUIRED':
            set.status = 403
            return { success: false, message: 'ตอนนี้ต้องซื้อก่อนอ่าน' }
        }
      }

      return { success: true, data: result }
    },
    {
      params: t.Object({
        uuid:   t.String(),
        ep_no:  t.Numeric({ minimum: 0 }),  // migration 010 — เลขลำดับตอนเริ่มจาก 0 ได้
      }),
      detail: {
        summary: 'อ่านตอน (manga=รูปภาพ, novel=blocks)',
        tags: ['Works'],
      },
    }
  )

  // --------------------------------------------------
  // GET /works/:uuid/comments
  // ดู comments ของผลงาน (public — ไม่ต้องล็อกอิน)
  // ดึง top-level comments พร้อม replies ในคราวเดียว
  // --------------------------------------------------
  .get(
    '/:uuid/comments',
    async ({ params, query, headers, set, jwt }) => {
      try {
        // ---- Optional Auth ---- เหมือนกับ /episodes/:ep_no/read — ไม่บังคับ login
        // แต่ถ้ามี token ใช้หา is_liked ของ viewer ปัจจุบันต่อคอมเม้นได้
        let viewerId: bigint | null = null
        const authorization = headers.authorization
        if (authorization?.startsWith('Bearer ')) {
          const token = authorization.slice(7)
          const payload = await jwt.verify(token)
          if (payload && payload.sub) {
            viewerId = BigInt(payload.sub as string)
          }
        }

        const result = await getComments(
          params.uuid,
          query.page  ?? 1,
          query.limit ?? 20,
          query.ep_no,
          viewerId,
        )
        return { success: true, ...result }
      } catch (err: any) {
        if (err.message === 'WORK_NOT_FOUND') {
          set.status = 404
          return { success: false, message: 'ไม่พบผลงานนี้' }
        }
        throw err
      }
    },
    {
      params: t.Object({ uuid: t.String() }),
      query: t.Object({
        page:   t.Optional(t.Numeric({ minimum: 1 })),
        limit:  t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
        ep_no:  t.Optional(t.Numeric({ minimum: 0 })),  // กรองเฉพาะ episode นั้น (เริ่มจาก 0 ได้)
      }),
      detail: { summary: 'ดู comments ของผลงาน (ep_no optional)', tags: ['Works'] },
    }
  )

  // --------------------------------------------------
  // POST /works/:uuid/comments
  // โพสต์ comment หรือ reply (ต้องล็อกอิน)
  // ส่ง parent_id มาด้วยถ้าต้องการ reply comment
  // --------------------------------------------------
  .post(
    '/:uuid/comments',
    async ({ params, body, headers, request, set, jwt }) => {
      // ตรวจ auth — endpoint นี้บังคับล็อกอิน
      const authorization = headers.authorization
      if (!authorization?.startsWith('Bearer ')) {
        set.status = 401
        return { success: false, message: 'กรุณาล็อกอินก่อน' }
      }
      const token = authorization.slice(7)
      const payload = await jwt.verify(token)
      if (!payload || !payload.sub) {
        set.status = 401
        return { success: false, message: 'Token ไม่ถูกต้องหรือหมดอายุ' }
      }

      const userId = BigInt(payload.sub as string)
      const limited = await enforceRateLimit(set, [
        accountRateLimitRule('comment-create-account', userId, 12, 15 * 60),
        ipRateLimitRule('comment-create-ip', request, 40, 15 * 60),
      ])
      if (limited) return limited

      try {
        const comment = await createComment(
          userId,
          params.uuid,
          body.content,
          body.parent_id ? BigInt(body.parent_id) : undefined,
          body.ep_no,
        )
        set.status = 201
        return { success: true, data: comment }
      } catch (err: any) {
        const map: Record<string, { status: number; message: string }> = {
          WORK_NOT_FOUND:           { status: 404, message: 'ไม่พบผลงานนี้' },
          EPISODE_NOT_FOUND:        { status: 404, message: 'ไม่พบตอนนี้' },
          COMMENT_NOT_FOUND:        { status: 404, message: 'ไม่พบ comment ที่จะ reply' },
          NESTED_REPLY_NOT_ALLOWED: { status: 400, message: 'ไม่รองรับการ reply ซ้อนกัน' },
          EMPTY_CONTENT:            { status: 400, message: 'กรุณากรอกข้อความ' },
        }
        const matched = map[err.message]
        if (matched) {
          set.status = matched.status
          return { success: false, message: matched.message }
        }
        throw err
      }
    },
    {
      params: t.Object({ uuid: t.String() }),
      body: t.Object({
        content:   t.String({ minLength: 1, maxLength: 1000 }),
        parent_id: t.Optional(t.String({ pattern: '^[0-9]+$' })),  // ID ของ comment ที่จะ reply
        ep_no:     t.Optional(t.Numeric({ minimum: 0 })),           // ส่งมาถ้าเป็น comment ในตอน (เริ่มจาก 0 ได้)
      }),
      detail: { summary: 'โพสต์ comment / reply', tags: ['Works'] },
    }
  )

// ---- Category Routes (/categories) ----

export const categoryRoutes = new Elysia({ prefix: '/categories' })
  // --------------------------------------------------
  // GET /categories
  // ดึง categories ทั้งหมดที่ active
  // (ไม่ต้องล็อกอิน — public endpoint)
  // --------------------------------------------------
  .get(
    '/',
    async () => {
      const categories = await getCategories()
      return { success: true, data: categories }
    },
    {
      detail: {
        summary: 'รายการหมวดหมู่',
        tags: ['Categories'],
      },
    }
  )

// ---- Tag Routes (/tags) ----

export const tagRoutes = new Elysia({ prefix: '/tags' })
  // --------------------------------------------------
  // GET /tags?search=&limit=
  // แนะนำ tag (หมวดหมู่ย่อย) แบบ autocomplete พร้อมจำนวนเรื่องที่ใช้ — public endpoint
  // --------------------------------------------------
  .get(
    '/',
    async ({ query }) => {
      const tags = await getTagSuggestions(query.search, query.limit ?? 20)
      return { success: true, data: tags }
    },
    {
      query: t.Object({
        search: t.Optional(t.String({ maxLength: 50 })),
        limit:  t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
      }),
      detail: {
        summary: 'แนะนำหมวดหมู่ย่อย (tag) แบบ autocomplete พร้อมจำนวนที่ใช้',
        tags: ['Categories'],
      },
    }
  )

// ---- Carousel Routes (/hero-slides) ----
// รูปโปรโมต Hero banner หน้าแรก — 2026-08-08: path สาธารณะเปลี่ยนจาก /carousels เป็น
// /hero-slides เพราะ "carousel" เป็นคำที่ ad blocker (AdBlock Plus ฯลฯ) ใช้เป็นกฎบล็อก
// มาตรฐาน (carousel ad คือรูปแบบโฆษณายอดฮิต) ทำให้ request ค้างไม่ตอบกลับเลยสำหรับคนที่ลง
// ad blocker ไว้ — ไม่แตะชื่อตาราง/ฟังก์ชันข้างในเลย (carousels table, getCarousels() ยังชื่อเดิม)
// แค่เปลี่ยน path ที่เบราว์เซอร์เห็นเท่านั้น (route ฝั่งแอดมิน /admin/carousels/* ไม่ได้แตะ
// เพราะเป็นทราฟฟิกของสตาฟ ไม่ใช่นักอ่านทั่วไปที่มักลง ad blocker)
export const carouselRoutes = new Elysia({ prefix: '/hero-slides' })
  .get(
    '/',
    async () => {
      const carousels = await getCarousels()
      return { success: true, data: carousels }
    },
    {
      detail: {
        summary: 'รายการรูปโปรโมต Hero banner',
        tags: ['Carousels'],
      },
    }
  )

// ---- Web Contacts Routes (/web-contacts) — สำหรับ Footer ----

export const webContactRoutes = new Elysia({ prefix: '/web-contacts' })
  .get(
    '/',
    async () => {
      const contacts = await getWebContacts()
      return { success: true, data: contacts }
    },
    {
      detail: {
        summary: 'ช่องทางติดต่อ/โซเชียลของเว็บ (สำหรับ Footer)',
        tags: ['Web Contacts'],
      },
    }
  )

// ---- FAQ Routes (/faqs) — หน้า "ติดต่อแอดมิน" ---- (migration 054, ใหม่)
// public, อ่านอย่างเดียว, เฉพาะ status=true — จัดการผ่าน /admin/faqs (level >= 9)

export const faqRoutes = new Elysia({ prefix: '/faqs' })
  .get(
    '/',
    async () => {
      const faqs = await getFaqs()
      return { success: true, data: faqs }
    },
    {
      detail: {
        summary: 'คำถามที่พบบ่อย (หน้าติดต่อแอดมิน)',
        tags: ['FAQ'],
      },
    }
  )

// ---- Announcement Routes (/announcements) — แถบประกาศหน้าแรก ----
// public, อ่านอย่างเดียว, เฉพาะ status='active' — จัดการ (สร้าง/แก้/ลบ) ผ่าน /admin/announcements
// (level >= 9) ที่มีอยู่แล้ว

export const announcementRoutes = new Elysia({ prefix: '/announcements' })
  .get(
    '/',
    async () => {
      const announcements = await getActiveAnnouncements()
      return { success: true, data: announcements }
    },
    {
      detail: {
        summary: 'ประกาศที่กำลังแสดงอยู่ (หน้าแรก)',
        tags: ['Announcements'],
      },
    }
  )
