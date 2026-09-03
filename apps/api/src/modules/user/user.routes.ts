import Elysia, { t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { authMiddleware } from '../../middleware/auth.middleware'
import { db } from '../../db'
import { updateProfileSchema, socialLinksSchema } from './user.schema'
import {
  updateProfile,
  getProfileStats,
  getPublicProfile,
  uploadAvatar,
  deleteAvatar,
  getSocialLinks,
  setSocialLinks,
  searchWriters,
  submitWriterApplication,
  getMyWriterApplication,
  getMyLoginHistory,
} from './user.service'
import { getAuthorWorks } from '../works/works.service'
import { getPublicBookmarks } from '../social/social.service'
import { checkMultipartUploadLimit } from '../../lib/upload-rate-limit'

export const userRoutes = new Elysia({ prefix: '/users' })
  .use(authMiddleware)
  .onBeforeHandle(async ({ user, request, set }) => {
    try {
      const result = await checkMultipartUploadLimit(request, user.id)
      if (result.allowed) return

      set.status = result.unavailable ? 503 : 429
      set.headers['Retry-After'] = String(result.retryAfterSeconds)
      return { success: false, message: result.unavailable ? 'ระบบตรวจสอบโควตาอัปโหลดไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' : 'อัปโหลดบ่อยเกินไป กรุณาลองใหม่ภายหลัง' }
    } catch (error) {
      console.error('[upload-rate-limit] user upload denied:', error)
      set.status = 503
      return { success: false, message: 'ระบบตรวจสอบโควตาอัปโหลดไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' }
    }
  })
  .get('/me', async ({ user }) => {
    const me = await db
      .selectFrom('users')
      .select(['id', 'uuid', 'u_name', 'display_name', 'email', 'level', 'point', 'user_img', 'bio', 'social_media', 'bookmarks_public', 'created_at'])
      .where('uuid', '=', user.uuid)
      .executeTakeFirstOrThrow()

    const [stats, socialLinks] = await Promise.all([
      getProfileStats(me.id, me.level >= 6),
      getSocialLinks(me.id),
    ])
    const { id: _id, ...publicMe } = me

    return {
      success: true,
      user: { ...publicMe, stats, social_links: socialLinks.map((l) => ({ url: l.url, label: l.label })) },
    }
  })
  .patch(
    '/me',
    async ({ user, body, set }) => {
      try {
        const updated = await updateProfile(user.uuid, body)
        return { success: true, user: updated }
      } catch (err: any) {
        if (err.message === 'USERNAME_TAKEN') {
          set.status = 409
          return { success: false, message: 'Username นี้ถูกใช้แล้ว' }
        }
        throw err
      }
    },
    { body: updateProfileSchema }
  )
  // --------------------------------------------------
  // GET /users/me/writer-application — ดูคำขอเป็นนักเขียนของตัวเอง (ล่าสุด ไม่ว่าสถานะไหน)
  // POST /users/me/writer-application — ส่งคำขอเป็นนักเขียน (แทนที่ mock เดิมฝั่ง apps/web)
  // เข้าถึงได้ทุก level (ไม่ต้อง login เป็นนักเขียนอยู่แล้วถึงจะส่งได้ — คือจุดประสงค์ของฟอร์มนี้เอง)
  // --------------------------------------------------
  .get('/me/writer-application', async ({ user }) => {
    const data = await getMyWriterApplication(BigInt(user.id))
    return { success: true, data }
  })
  .post(
    '/me/writer-application',
    async ({ user, body, set }) => {
      try {
        const data = await submitWriterApplication(BigInt(user.id), user.level, body)
        set.status = 201
        return { success: true, data }
      } catch (err: any) {
        if (err.message === 'APPLICATION_ALREADY_PENDING') {
          set.status = 400
          return { success: false, message: 'มีคำขอที่รอตรวจสอบอยู่แล้ว' }
        }
        if (err.message === 'ALREADY_WRITER') {
          set.status = 400
          return { success: false, message: 'บัญชีนี้เป็นนักเขียนอยู่แล้ว' }
        }
        throw err
      }
    },
    {
      body: t.Object({
        user_prefix: t.String({ minLength: 1, maxLength: 20 }),
        first_name: t.String({ minLength: 1, maxLength: 100 }),
        last_name: t.String({ minLength: 1, maxLength: 100 }),
        national_id: t.Optional(t.String({ maxLength: 20 })),
        id_address: t.Optional(t.String({ maxLength: 500 })),
        id_province: t.Optional(t.String({ maxLength: 100 })),
        id_district: t.Optional(t.String({ maxLength: 100 })),
        id_subdistrict: t.Optional(t.String({ maxLength: 100 })),
        id_postal_code: t.Optional(t.String({ maxLength: 10 })),
        current_address: t.Optional(t.String({ maxLength: 500 })),
        current_province: t.Optional(t.String({ maxLength: 100 })),
        current_district: t.Optional(t.String({ maxLength: 100 })),
        current_subdistrict: t.Optional(t.String({ maxLength: 100 })),
        current_postal_code: t.Optional(t.String({ maxLength: 10 })),
        user_phone: t.String({ minLength: 1, maxLength: 20 }),
        bank_name: t.String({ minLength: 1, maxLength: 100 }),
        bank_branch: t.Optional(t.String({ maxLength: 100 })),
        bank_number: t.Optional(t.String({ maxLength: 50 })),
      }),
    },
  )
  // --------------------------------------------------
  // GET /users/me/login-history — ประวัติการล็อกอินของตัวเอง (หน้าตั้งค่า, 2026-08-18)
  // --------------------------------------------------
  .get(
    '/me/login-history',
    async ({ user, query }) => {
      const data = await getMyLoginHistory(BigInt(user.id), query.page ?? 1, query.limit ?? 20)
      return { success: true, ...data }
    },
    {
      query: t.Object({
        page:  t.Optional(t.Numeric({ minimum: 1 })),
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
      }),
      detail: { summary: 'ประวัติการล็อกอินของตัวเอง (ดูว่าล็อกอินไว้ที่ไหนบ้าง)', tags: ['Users'] },
    }
  )
  // --------------------------------------------------
  // POST /users/me/avatar — อัปโหลดรูปโปรไฟล์
  // ⚠️ ไม่ใช้ t.File() เหมือน uploadCover (writer.routes.ts) เพราะ Elysia มีบั๊กรู้จักแล้ว
  // (elysiajs/elysia issue #780, #1119, #782) เลย parse เองผ่าน request.formData() แทน
  // --------------------------------------------------
  .post('/me/avatar', async ({ user, request, set }) => {
    try {
      const formData = await request.formData()
      const file = formData.get('avatar')

      if (!(file instanceof File)) {
        set.status = 400
        return { success: false, message: 'ไม่พบไฟล์รูปโปรไฟล์' }
      }
      if (file.size > 5 * 1024 * 1024) {
        set.status = 400
        return { success: false, message: 'ไฟล์ต้องไม่เกิน 5MB' }
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const result = await uploadAvatar(user.uuid, buffer, file.type)
      return { success: true, data: result }
    } catch (err: any) {
      if (err.message === 'INVALID_FILE_TYPE') {
        set.status = 400
        return { success: false, message: 'รองรับเฉพาะ JPG, PNG, WebP เท่านั้น' }
      }
      throw err
    }
  }, {
    detail: { summary: 'อัปโหลดรูปโปรไฟล์', tags: ['Users'] },
  })
  .delete('/me/avatar', async ({ user }) => {
    await deleteAvatar(user.uuid)
    return { success: true }
  }, {
    detail: { summary: 'ลบรูปโปรไฟล์', tags: ['Users'] },
  })
  // --------------------------------------------------
  // PUT /users/me/social-links — แทนที่ลิงก์ช่องทางทั้งหมดทีเดียว (สูงสุด 4 อัน)
  // --------------------------------------------------
  .put(
    '/me/social-links',
    async ({ user, body, set }) => {
      try {
        const links = await setSocialLinks(BigInt(user.id), body.links)
        return { success: true, data: links.map((l) => ({ url: l.url, label: l.label })) }
      } catch (err: any) {
        if (err.message === 'TOO_MANY_SOCIAL_LINKS') {
          set.status = 400
          return { success: false, message: `เพิ่มช่องทางได้สูงสุด 4 อันเท่านั้น` }
        }
        throw err
      }
    },
    {
      body: socialLinksSchema,
      detail: { summary: 'แทนที่ลิงก์ช่องทางโซเชียลทั้งหมด (สูงสุด 4 อัน)', tags: ['Users'] },
    }
  )

// ---- Public Profile Routes (/users/:uuid) ----
// แยกจาก userRoutes ด้านบนเพราะไม่ต้อง login (ดูโปรไฟล์คนอื่นได้แบบ public เหมือน
// Tofu Novel ที่ user เอามาอ้างอิง) — ไม่มี authMiddleware ในกลุ่มนี้เลย
export const publicUserRoutes = new Elysia({ prefix: '/users' })
  .use(jwt({ name: 'jwt', secret: process.env.JWT_SECRET! }))
  // --------------------------------------------------
  // GET /users/search — ค้นหานักเขียน (หน้า /search โหมด "นักเขียน", 2026-07-30)
  // ⚠️ ต้องอยู่ก่อน /:uuid เสมอ (Elysia match จากบนลงล่าง ไม่ prioritize static เหนือ dynamic
  // เอง) ไม่งั้น "/users/search" จะโดน /:uuid จับไปตีความ "search" เป็น uuid แทน
  // --------------------------------------------------
  .get(
    '/search',
    async ({ query }) => {
      const data = await searchWriters(query.search, query.page ?? 1, query.limit ?? 20)
      return { success: true, ...data }
    },
    {
      query: t.Object({
        search: t.Optional(t.String({ maxLength: 100 })),
        page:   t.Optional(t.Numeric({ minimum: 1 })),
        limit:  t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
      }),
      detail: { summary: 'ค้นหานักเขียน (level 6-7 เท่านั้น ไม่รวมแอดมิน) ด้วยชื่อที่แสดง', tags: ['Users'] },
    }
  )
  .get(
    '/:uuid',
    async ({ params, set, headers, jwt }) => {
      // optional-auth: มี token ก็ใช้หา is_following ของ viewer ปัจจุบันได้ ไม่มีก็ดูได้ปกติ
      // (pattern เดียวกับ getWorkByUuid ใน works.routes.ts)
      let viewerId: bigint | null = null
      const authorization = headers.authorization
      if (authorization?.startsWith('Bearer ')) {
        const token = authorization.slice(7)
        const payload = await jwt.verify(token)
        if (payload && payload.sub) {
          viewerId = BigInt(payload.sub as string)
        }
      }

      try {
        const profile = await getPublicProfile(params.uuid, viewerId)
        return { success: true, data: profile }
      } catch (err: any) {
        if (err.message === 'USER_NOT_FOUND') {
          set.status = 404
          return { success: false, message: 'ไม่พบผู้ใช้นี้' }
        }
        throw err
      }
    },
    {
      params: t.Object({ uuid: t.String() }),
      detail: { summary: 'โปรไฟล์สาธารณะของ user (ดูได้โดยไม่ต้อง login)', tags: ['Users'] },
    }
  )
  // --------------------------------------------------
  // GET /users/:uuid/works — ผลงานที่เผยแพร่ไว้ของ user คนไหนก็ได้ (public)
  // 2026-07-29 มติแก้: เดิมเข้าใจผิดว่าเป็นนิยายที่เก็บเข้าคลังไว้ (bookmark) — user ยืนยันว่า
  // ควรเป็นนิยายที่เจ้าของโปรไฟล์เขียน/เผยแพร่เอง (เหมือนโชว์ผลงานตัวเอง ไม่ใช่ของที่ตัวเองอ่าน)
  // — เดิมชื่อ route "/bookshelf" เปลี่ยนเป็น "/works" ให้ตรงความหมายใหม่
  // --------------------------------------------------
  .get(
    '/:uuid/works',
    async ({ params, query, set }) => {
      const user = await db.selectFrom('users').select('id').where('uuid', '=', params.uuid).executeTakeFirst()
      if (!user) {
        set.status = 404
        return { success: false, message: 'ไม่พบผู้ใช้นี้' }
      }

      const result = await getAuthorWorks(user.id, query.page ?? 1, query.limit ?? 12, query.featured ?? false, query.search, query.sort ?? 'latest')
      return { success: true, ...result }
    },
    {
      params: t.Object({ uuid: t.String() }),
      query: t.Object({
        page:     t.Optional(t.Numeric({ minimum: 1 })),
        limit:    t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
        featured: t.Optional(t.Boolean()),
        search:   t.Optional(t.String()),
        sort:     t.Optional(t.Union([t.Literal('latest'), t.Literal('popular')])),
      }),
      detail: { summary: 'ผลงานที่เผยแพร่ไว้ของ user คนไหนก็ได้ (public) — featured=true กรองเฉพาะ "นิยายแนะนำ" ที่ปักหมุดไว้, search ค้นจากชื่อเรื่อง, sort=latest|popular', tags: ['Users'] },
    }
  )
  // --------------------------------------------------
  // GET /users/:uuid/bookmarks — นิยายที่เก็บเข้าคลังไว้ของ user คนไหนก็ได้ (public)
  // 2026-07-29: สำหรับโปรไฟล์นักอ่านทั่วไป (ไม่ใช่นักเขียน) ใช้แทน "/works" ที่ฝั่งนักเขียนใช้ —
  // เจ้าของตั้งซ่อนจากคนอื่นได้ (users.bookmarks_public, default true) เจ้าของเองเห็นเสมอไม่ว่า
  // ตั้งค่าไว้ยังไง (ใช้ optional-auth หา viewerId เทียบกับเจ้าของโปรไฟล์)
  // --------------------------------------------------
  .get(
    '/:uuid/bookmarks',
    async ({ params, query, set, headers, jwt }) => {
      const user = await db.selectFrom('users').select('id').where('uuid', '=', params.uuid).executeTakeFirst()
      if (!user) {
        set.status = 404
        return { success: false, message: 'ไม่พบผู้ใช้นี้' }
      }

      let viewerId: bigint | null = null
      const authorization = headers.authorization
      if (authorization?.startsWith('Bearer ')) {
        const token = authorization.slice(7)
        const payload = await jwt.verify(token)
        if (payload && payload.sub) viewerId = BigInt(payload.sub as string)
      }

      const result = await getPublicBookmarks(user.id, viewerId, query.page ?? 1, query.limit ?? 12, query.featured ?? false, query.search, query.sort ?? 'latest')
      return { success: true, ...result }
    },
    {
      params: t.Object({ uuid: t.String() }),
      query: t.Object({
        page:     t.Optional(t.Numeric({ minimum: 1 })),
        limit:    t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
        featured: t.Optional(t.Boolean()),
        search:   t.Optional(t.String()),
        sort:     t.Optional(t.Union([t.Literal('latest'), t.Literal('popular')])),
      }),
      detail: { summary: 'นิยายที่เก็บเข้าคลังไว้ของ user คนไหนก็ได้ (public) — เคารพ bookmarks_public, search ค้นจากชื่อเรื่อง, sort=latest|popular', tags: ['Users'] },
    }
  )
