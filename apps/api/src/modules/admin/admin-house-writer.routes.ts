// =============================================================
// Novel Platform — Admin House-Writer Routes (2026-08-10, ใหม่)
// วางไว้ที่: apps/api/src/modules/admin/admin-house-writer.routes.ts
// =============================================================
//
// แท็บ "เพิ่มนักเขียนของเว็บ" — level >= 9 เท่านั้น (เหมือน admin-works.routes.ts)
// body schema ของ POST /works ก็อปจาก writer.routes.ts ตรงๆ ให้ตรงกับฟอร์มฝั่ง writer เป๊ะ
// (ดู admin-house-writer.service.ts สำหรับ pattern "สวม target_user_id เป็นเจ้าของ")

import Elysia, { t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { checkMultipartUploadLimit } from '../../lib/upload-rate-limit'
import { requirePermission } from '../../lib/permission-guard'
import {
  createWorkForHouseWriter,
  startNovelBulkUpload,
  getNovelBulkUploadJobStatus,
} from './admin-house-writer.service'

function handleHouseWriterError(err: any, set: any) {
  const map: Record<string, { status: number; message: string }> = {
    USER_NOT_FOUND:     { status: 404, message: 'ไม่พบผู้ใช้นี้' },
    NOT_HOUSE_WRITER:    { status: 400, message: 'บัญชีนี้ไม่ใช่ "นักเขียนของเว็บ" (ต้องเป็น level 7)' },
    ZIP_TOO_LARGE:       { status: 400, message: 'ไฟล์ zip ต้องไม่เกิน 500MB' },
    INVALID_ZIP:         { status: 400, message: 'ไฟล์นี้ไม่ใช่ zip ที่ถูกต้อง' },
    TOO_MANY_FILES:      { status: 400, message: 'zip มีไฟล์รวมเกิน 5000 ไฟล์' },
    NO_VALID_FOLDERS:    { status: 400, message: 'ไม่พบโฟลเดอร์นิยายในไฟล์ zip นี้เลย (ต้องมีโฟลเดอร์ระดับบนสุดอย่างน้อย 1 โฟลเดอร์)' },
    TOO_MANY_FOLDERS:    { status: 400, message: 'zip มีโฟลเดอร์นิยายเกิน 150 เรื่อง' },
    JOB_NOT_FOUND:       { status: 404, message: 'ไม่พบงานอัปโหลดนี้' },
  }

  const matched = map[err.message]
  if (matched) {
    set.status = matched.status
    return { success: false, message: matched.message }
  }

  throw err
}

export const adminHouseWriterRoutes = new Elysia({ prefix: '/admin' })
  .use(authMiddleware)
  // ❗ level >= 9 เหมือน admin-works.routes.ts (สร้าง/อัพเนื้อหาแทนบัญชีอื่นเป็นสิทธิ์ระดับเดียวกัน)
  .onBeforeHandle(async ({ user, set }) => {
    if (!(await requirePermission(user, 'content.house_writer.manage', set))) {
      return { success: false, message: 'ต้องเป็นแอดมินรองขึ้นไป (level >= 9) หรือได้รับสิทธิ์จากหน้าตั้งค่า' }
    }
  })
  .onBeforeHandle(async ({ user, request, set }) => {
    try {
      const result = await checkMultipartUploadLimit(request, user.id)
      if (result.allowed) return

      set.status = result.unavailable ? 503 : 429
      set.headers['Retry-After'] = String(result.retryAfterSeconds)
      return { success: false, message: result.unavailable ? 'ระบบตรวจสอบโควตาอัปโหลดไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' : 'อัปโหลดบ่อยเกินไป กรุณาลองใหม่ภายหลัง' }
    } catch (error) {
      console.error('[upload-rate-limit] admin-house-writer upload denied:', error)
      set.status = 503
      return { success: false, message: 'ระบบตรวจสอบโควตาอัปโหลดไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' }
    }
  })

  // --------------------------------------------------
  // POST /admin/house-writers/:uuid/works
  // เพิ่มนิยายใหม่ (เรื่องเดียว) แทนบัญชี "นักเขียนของเว็บ" — field เดียวกับ POST /writer/works
  // --------------------------------------------------
  .post('/house-writers/:uuid/works', async ({ user, params, body, set }) => {
    try {
      const work = await createWorkForHouseWriter(BigInt(user.id), params.uuid, {
        title:             body.title,
        original_title:    body.original_title,
        description:       body.description,
        type:              body.type,
        category_main:     body.category_main ?? undefined,
        category_sub:      body.category_sub ?? undefined,
        origin_type:       body.origin_type as 1 | 2 | 3 | 4 | undefined,
        age_rate:          body.age_rate as 'all' | '18+' | undefined,
        is_translated:     body.is_translated,
        tags:              body.tags,
        is_one_shot:       body.is_one_shot,
        completion_status: body.completion_status as 'ongoing' | 'completed' | 'hiatus' | undefined,
      })
      set.status = 201
      return { success: true, data: work }
    } catch (err: any) {
      return handleHouseWriterError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({
      title:             t.String({ minLength: 1, maxLength: 200 }),
      original_title:    t.Optional(t.String({ maxLength: 200 })),
      description:       t.Optional(t.String({ maxLength: 2000 })),
      type:              t.Union([t.Literal('manga'), t.Literal('novel')]),
      category_main:     t.Optional(t.Nullable(t.Number())),
      category_sub:      t.Optional(t.Nullable(t.Number())),
      origin_type:       t.Optional(t.Nullable(t.Number())),
      age_rate:          t.Optional(t.Union([t.Literal('all'), t.Literal('18+')])),
      is_translated:     t.Optional(t.Boolean()),
      tags:              t.Optional(t.Array(t.String({ maxLength: 30 }), { maxItems: 20 })),
      is_one_shot:       t.Optional(t.Boolean()),
      completion_status: t.Optional(t.String()),
    }),
    detail: { summary: 'เพิ่มนิยายใหม่แทนนักเขียนของเว็บ', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // POST /admin/house-writers/:uuid/works/bulk-upload
  // เพิ่มนิยายหลายเรื่อง — zip (โฟลเดอร์ = นิยาย 1 เรื่อง) — ประมวลผลเบื้องหลัง คืน job_id ทันที
  // --------------------------------------------------
  .post('/house-writers/:uuid/works/bulk-upload', async ({ user, params, request, set }) => {
    try {
      const formData = await request.formData()
      const file = formData.get('zip')
      // ตัด chunk ภาษาต่างประเทศ (เกาหลี/อังกฤษ) ที่ไม่มีภาษาไทยปนเลย — toggle ฝั่งแอดมินเท่านั้น
      // (2026-08-10 user ขอ) default false ถ้าไม่ส่งมา
      const stripForeignChunks = formData.get('strip_foreign_chunks') === 'true'

      if (!(file instanceof File)) {
        set.status = 400
        return { success: false, message: 'ไม่พบไฟล์ zip' }
      }
      if (file.size > 500 * 1024 * 1024) {
        set.status = 400
        return { success: false, message: 'ไฟล์ zip ต้องไม่เกิน 500MB' }
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const result = await startNovelBulkUpload(BigInt(user.id), params.uuid, buffer, stripForeignChunks)
      set.status = 202 // Accepted — งานยังทำอยู่เบื้องหลัง ยังไม่เสร็จตอนตอบกลับ
      return { success: true, data: result }
    } catch (err: any) {
      return handleHouseWriterError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'เพิ่มนิยายหลายเรื่อง (zip, multipart field "zip")', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // GET /admin/house-writer-uploads/:jobId — เช็คความคืบหน้า (polling)
  // --------------------------------------------------
  .get('/house-writer-uploads/:jobId', async ({ user, params, set }) => {
    try {
      const data = await getNovelBulkUploadJobStatus(BigInt(user.id), BigInt(params.jobId))
      return { success: true, data }
    } catch (err: any) {
      return handleHouseWriterError(err, set)
    }
  }, {
    params: t.Object({ jobId: t.String() }),
    detail: { summary: 'เช็คความคืบหน้าอัปโหลดนิยายหลายเรื่อง', tags: ['Admin'] },
  })
