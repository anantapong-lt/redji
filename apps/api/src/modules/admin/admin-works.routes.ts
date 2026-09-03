// =============================================================
// Novel Platform — Admin Works Routes (2026-08-04, ใหม่)
// วางไว้ที่: apps/api/src/modules/admin/admin-works.routes.ts
// =============================================================
//
// แท็บ "ผลงาน" — level >= 9 เท่านั้น เข้าถึง/แก้ผลงานของนักเขียนคนไหนก็ได้เหมือนนักเขียนแก้เอง
// (ดู admin-works.service.ts สำหรับ pattern "delegate ไปที่ writer.service.ts โดยสวม author_id")
//
// body/query schema ก็อปจาก writer.routes.ts ตรงๆ (endpoint คู่กันทุกจุด) ให้ payload ตรงกันเป๊ะ —
// เพราะฝั่ง frontend เอา component เดิมของ writer มาใช้ซ้ำ

import Elysia, { t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { checkMultipartUploadLimit } from '../../lib/upload-rate-limit'
import { requirePermission } from '../../lib/permission-guard'
import { handleServiceError } from '../writer/writer.routes'
import {
  listWorksGallery,
  getWorkDetailAdmin, updateWorkAdmin, uploadCoverAdmin, deleteWorkAdmin, permaDeleteWorkAdmin,
  getWorkStatsAdmin, getWorkViewsMonthlyAdmin, getWorkViewsYearlyAdmin, getWorkTopEpisodesAdmin,
  getEpisodesAdmin, createEpisodeAdmin,
  getEpisodeDetailAdmin, updateEpisodeAdmin, deleteEpisodeAdmin,
} from './admin-works.service'
import { createWriterNotice } from './admin.service'

export const adminWorksRoutes = new Elysia({ prefix: '/admin' })
  .use(authMiddleware)
  // ❗ level >= 9 ทุก endpoint ในไฟล์นี้ (user ยืนยัน "เฉพาะ level 9" = 9 ขึ้นไป ตรงกับรูปแบบเดิม
  // ที่ใช้ทั่วระบบ เช่น Analytic/จัดการธุรกรรม)
  .onBeforeHandle(async ({ user, set }) => {
    if (!(await requirePermission(user, 'content.works.manage', set))) {
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
      console.error('[upload-rate-limit] admin-work upload denied:', error)
      set.status = 503
      return { success: false, message: 'ระบบตรวจสอบโควตาอัปโหลดไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' }
    }
  })

  // --------------------------------------------------
  // GET /admin/works — gallery: ค้นหาชื่อ + กรองนักเขียน (พิมพ์ username/display name) + กรอง 18+
  // เรียงตามแก้ไขล่าสุด
  // --------------------------------------------------
  .get('/works', async ({ query }) => {
    const data = await listWorksGallery({
      page:          query.page  ?? 1,
      limit:         query.limit ?? 24,
      search:        query.search,
      authorSearch:  query.author,
      ageRate:       query.age_rate as 'all' | '18+' | undefined,
      publishedOnly: query.published_only,
      publishStatus: query.publish_status as 0 | 1 | undefined,
      status:        query.status,
    })
    return { success: true, ...data }
  }, {
    query: t.Object({
      page:           t.Optional(t.Numeric({ minimum: 1 })),
      limit:          t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      search:         t.Optional(t.String({ maxLength: 100 })),
      author:         t.Optional(t.String({ maxLength: 100 })),
      age_rate:       t.Optional(t.Union([t.Literal('all'), t.Literal('18+')])),
      // เฉพาะ picker "นิยายแนะนำ" ใช้ (2026-08-04) — กันเลือกเรื่อง draft เข้าคิวบูสต์ (ไม่มีวัน
      // โผล่หน้าเว็บจริงเพราะ publish_status=1 อยู่แล้วเสมอในทุก query สาธารณะ)
      published_only: t.Optional(t.Boolean()),
      // ตัวกรอง "สถานะ" ในหน้า gallery หลัก (2026-08-05) — 0=ยังไม่เผยแพร่ (ซ่อนอยู่), 1=เผยแพร่แล้ว
      // ใช้ t.Numeric (เหมือน page/limit) เพราะ query string เป็น string เสมอ ต้องให้ Elysia coerce
      // เป็นตัวเลขก่อน — t.Literal(0|1) ตรงๆ จะไม่ coerce จาก "0"/"1" ให้อัตโนมัติ
      publish_status: t.Optional(t.Numeric({ minimum: 0, maximum: 1 })),
      // 2026-08-10 ใหม่ — ดูเฉพาะที่ถูก soft-delete ไปแล้ว (undefined = active เท่านั้นเหมือนเดิม)
      status:         t.Optional(t.Union([t.Literal('active'), t.Literal('deleted')])),
    }),
    detail: { summary: 'Gallery ผลงานทั้งหมด (level >= 9)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // GET /admin/works/:uuid — ดูข้อมูลผลงานเรื่องเดียวแบบเต็ม (เหมือน writer)
  // --------------------------------------------------
  .get('/works/:uuid', async ({ params, set }) => {
    try {
      const data = await getWorkDetailAdmin(params.uuid)
      return { success: true, data }
    } catch (err: any) { return handleServiceError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'ดูข้อมูลผลงานเรื่องเดียว (admin)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // PATCH /admin/works/:uuid — แก้ข้อมูลผลงาน (field เดียวกับ writer PATCH เป๊ะ)
  // --------------------------------------------------
  .patch('/works/:uuid', async ({ user, params, body, set }) => {
    try {
      const updated = await updateWorkAdmin(BigInt(user.id), params.uuid, {
        title:             body.title,
        original_title:    body.original_title,
        description:       body.description,
        synopsis:          body.synopsis as object | null | undefined,
        category_main:     body.category_main,
        category_sub:      body.category_sub,
        origin_type:       body.origin_type as 1 | 2 | 3 | 4 | null | undefined,
        age_rate:          body.age_rate as 'all' | '18+' | null | undefined,
        is_translated:     body.is_translated,
        tags:              body.tags,
        is_one_shot:       body.is_one_shot,
        completion_status: body.completion_status as 'ongoing' | 'completed' | 'hiatus' | null | undefined,
        publish_status:    body.publish_status as 0 | 1 | undefined,
      })
      return { success: true, data: updated }
    } catch (err: any) { return handleServiceError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({
      title:             t.Optional(t.String({ minLength: 1, maxLength: 200 })),
      original_title:    t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
      description:       t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
      synopsis:          t.Optional(t.Nullable(t.Any())),
      category_main:     t.Optional(t.Nullable(t.Number())),
      category_sub:      t.Optional(t.Nullable(t.Number())),
      origin_type:       t.Optional(t.Nullable(t.Number())),
      age_rate:          t.Optional(t.Nullable(t.Union([t.Literal('all'), t.Literal('18+')]))),
      is_translated:     t.Optional(t.Boolean()),
      tags:              t.Optional(t.Array(t.String({ maxLength: 30 }), { maxItems: 20 })),
      is_one_shot:       t.Optional(t.Boolean()),
      completion_status: t.Optional(t.Nullable(t.String())),
      publish_status:    t.Optional(t.Number()),
    }),
    detail: { summary: 'แก้ข้อมูลผลงาน (admin)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // POST /admin/works/:uuid/cover — อัปโหลด cover (multipart, field "cover" เหมือน writer)
  // --------------------------------------------------
  .post('/works/:uuid/cover', async ({ user, params, request, set }) => {
    try {
      const formData = await request.formData()
      const file = formData.get('cover')

      if (!(file instanceof File)) {
        set.status = 400
        return { success: false, message: 'ไม่พบไฟล์ cover' }
      }
      if (file.size > 5 * 1024 * 1024) {
        set.status = 400
        return { success: false, message: 'ไฟล์ต้องไม่เกิน 5MB' }
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const result = await uploadCoverAdmin(BigInt(user.id), params.uuid, buffer, file.type, file.name)
      return { success: true, data: result }
    } catch (err: any) { return handleServiceError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'อัปโหลด cover image (admin)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // POST /admin/works/:uuid/notice — ส่งรายงาน/แจ้งเตือนถึงนักเขียนเจ้าของผลงานเรื่องนี้ตรงๆ
  // (writer_admin_notices, migration 032) — นักเขียนเห็นในแท็บ "รายงานจากแอดมิน"
  // --------------------------------------------------
  .post('/works/:uuid/notice', async ({ user, params, body, set }) => {
    try {
      const data = await createWriterNotice(BigInt(user.id), params.uuid, body.message)
      set.status = 201
      return { success: true, data }
    } catch (err: any) {
      const map: Record<string, { status: number; message: string }> = {
        EMPTY_MESSAGE: { status: 400, message: 'กรุณากรอกข้อความ' },
        WORK_NOT_FOUND: { status: 404, message: 'ไม่พบผลงานนี้' },
      }
      const matched = map[err.message]
      if (matched) { set.status = matched.status; return { success: false, message: matched.message } }
      throw err
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({ message: t.String({ minLength: 1, maxLength: 1000 }) }),
    detail: { summary: 'ส่งรายงานถึงนักเขียนเจ้าของผลงาน (admin)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // GET /admin/works/:uuid/stats — สถิติผลงาน (เหมือนหน้านักเขียนเอง, 2026-08-05 ใหม่)
  // --------------------------------------------------
  .get('/works/:uuid/stats', async ({ params, set }) => {
    try {
      const data = await getWorkStatsAdmin(params.uuid)
      return { success: true, data }
    } catch (err: any) { return handleServiceError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'ดูสถิติผลงาน (admin)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // GET /admin/works/:uuid/stats/monthly?year=2026&month=8
  // กราฟยอดวิวรายวันภายในเดือนที่เลือก — แท็บ "สถิติเจาะลึก" ฝั่งแอดมิน
  // --------------------------------------------------
  .get('/works/:uuid/stats/monthly', async ({ params, query, set }) => {
    try {
      const data = await getWorkViewsMonthlyAdmin(params.uuid, query.year, query.month)
      return { success: true, data }
    } catch (err: any) { return handleServiceError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    query: t.Object({
      year:  t.Numeric({ minimum: 2020, maximum: 2100 }),
      month: t.Numeric({ minimum: 1, maximum: 12 }),
    }),
    detail: { summary: 'กราฟยอดวิวรายวันภายในเดือนที่เลือก (admin)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // GET /admin/works/:uuid/stats/yearly?year=2026
  // กราฟยอดวิวรายเดือนภายในปีที่เลือก — แท็บ "สถิติเจาะลึก" ฝั่งแอดมิน
  // --------------------------------------------------
  .get('/works/:uuid/stats/yearly', async ({ params, query, set }) => {
    try {
      const data = await getWorkViewsYearlyAdmin(params.uuid, query.year)
      return { success: true, data }
    } catch (err: any) { return handleServiceError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    query: t.Object({ year: t.Numeric({ minimum: 2020, maximum: 2100 }) }),
    detail: { summary: 'กราฟยอดวิวรายเดือนภายในปีที่เลือก (admin)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // GET /admin/works/:uuid/stats/top-episodes
  // 10 อันดับตอนที่มียอดวิวสูงสุด — แท็บ "สถิติเจาะลึก" ฝั่งแอดมิน
  // --------------------------------------------------
  .get('/works/:uuid/stats/top-episodes', async ({ params, set }) => {
    try {
      const data = await getWorkTopEpisodesAdmin(params.uuid, 10)
      return { success: true, data }
    } catch (err: any) { return handleServiceError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: '10 อันดับตอนที่มียอดวิวสูงสุด (admin)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // GET /admin/works/:uuid/episodes — รายการตอนของผลงานนี้
  // --------------------------------------------------
  .get('/works/:uuid/episodes', async ({ params, set }) => {
    try {
      const data = await getEpisodesAdmin(params.uuid)
      return { success: true, data }
    } catch (err: any) { return handleServiceError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'รายการตอนของผลงาน (admin)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // POST /admin/works/:uuid/episodes — สร้างตอนใหม่
  // --------------------------------------------------
  .post('/works/:uuid/episodes', async ({ user, params, body, set }) => {
    try {
      const episode = await createEpisodeAdmin(BigInt(user.id), params.uuid, {
        ep_name:            body.ep_name,
        ep_no:              body.ep_no,
        ep_price:           body.ep_price,
        publish_status:     body.publish_status as 'now' | 'schedule' | 'hide' | undefined,
        schedule_datetime:  body.schedule_datetime ? new Date(body.schedule_datetime) : undefined,
        lock_duration_days: body.lock_duration_days,
        image_protection:   body.image_protection,
        ep_content:         body.ep_content as any,
        episode_label:      body.episode_label,
        reader_message:     body.reader_message,
      })
      set.status = 201
      return { success: true, data: episode }
    } catch (err: any) { return handleServiceError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({
      ep_name:            t.String({ minLength: 1, maxLength: 200 }),
      ep_no:              t.Optional(t.Numeric({ minimum: 0 })),
      ep_price:           t.Optional(t.String()),
      publish_status:     t.Optional(t.String()),
      schedule_datetime:  t.Optional(t.String()),
      lock_duration_days: t.Optional(t.Number()),
      reader_message:     t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
      image_protection:   t.Optional(t.Boolean()),
      episode_label:      t.Optional(t.Nullable(t.String({ maxLength: 30 }))),
      ep_content:         t.Optional(t.Any()),
    }),
    detail: { summary: 'สร้างตอนใหม่ (admin)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // GET /admin/episodes/:ep_id — ดูข้อมูลตอนเดียวแบบเต็ม
  // --------------------------------------------------
  .get('/episodes/:ep_id', async ({ params, set }) => {
    try {
      const episode = await getEpisodeDetailAdmin(BigInt(params.ep_id))
      return { success: true, data: episode }
    } catch (err: any) { return handleServiceError(err, set) }
  }, {
    params: t.Object({ ep_id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'ดูข้อมูลตอนเดียวแบบเต็ม (admin)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // PATCH /admin/episodes/:ep_id — แก้ข้อมูลตอน (รวมสั่งเผยแพร่/ไม่เผยแพร่ผ่าน publish_status)
  // --------------------------------------------------
  .patch('/episodes/:ep_id', async ({ user, params, body, set }) => {
    try {
      const epId = BigInt(params.ep_id)
      const updated = await updateEpisodeAdmin(BigInt(user.id), epId, {
        ep_name:            body.ep_name,
        ep_no:              body.ep_no,
        ep_price:           body.ep_price,
        publish_status:     body.publish_status as 'now' | 'schedule' | 'hide' | undefined,
        schedule_datetime:  body.schedule_datetime ? new Date(body.schedule_datetime) : undefined,
        lock_duration_days: body.lock_duration_days,
        image_protection:   body.image_protection,
        ep_content:         body.ep_content as any,
        episode_label:      body.episode_label,
        reader_message:     body.reader_message,
      })
      return { success: true, data: updated }
    } catch (err: any) { return handleServiceError(err, set) }
  }, {
    params: t.Object({ ep_id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Object({
      ep_name:            t.Optional(t.String({ minLength: 1, maxLength: 200 })),
      ep_no:              t.Optional(t.Numeric({ minimum: 0 })),
      ep_price:           t.Optional(t.String()),
      publish_status:     t.Optional(t.String()),
      schedule_datetime:  t.Optional(t.Nullable(t.String())),
      lock_duration_days: t.Optional(t.Nullable(t.Number())),
      image_protection:   t.Optional(t.Boolean()),
      ep_content:         t.Optional(t.Any()),
      episode_label:      t.Optional(t.Nullable(t.String({ maxLength: 30 }))),
      reader_message:     t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
    }),
    detail: { summary: 'แก้ข้อมูลตอน (admin)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // DELETE /admin/episodes/:ep_id — ลบตอน (soft delete)
  // --------------------------------------------------
  .delete('/episodes/:ep_id', async ({ user, params, set }) => {
    try {
      await deleteEpisodeAdmin(BigInt(user.id), BigInt(params.ep_id))
      set.status = 204
    } catch (err: any) { return handleServiceError(err, set) }
  }, {
    params: t.Object({ ep_id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'ลบตอน (admin)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // DELETE /admin/works/:uuid — ลบผลงาน (soft delete) — level >= 9 (เกณฑ์เดิมของทั้งไฟล์)
  // --------------------------------------------------
  .delete('/works/:uuid', async ({ user, params, set }) => {
    try {
      await deleteWorkAdmin(BigInt(user.id), params.uuid)
      set.status = 204
    } catch (err: any) { return handleServiceError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'ลบผลงาน (soft delete, admin)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // DELETE /admin/works/:uuid/permanent — ลบผลงานถาวร (2026-08-10, ใหม่)
  // level >= 10 เท่านั้น (เช็คเพิ่มอีกชั้นตรงนี้ — ทั้งไฟล์ gate ไว้แค่ level >= 9) ใช้เฉพาะกรณี
  // ผิดพลาดจริงๆ เท่านั้น ไม่ผ่านการทำงานปกติ (ดูคำเตือนที่ frontend ก่อนเรียก endpoint นี้)
  // --------------------------------------------------
  .delete('/works/:uuid/permanent', async ({ user, params, set }) => {
    if (!(await requirePermission(user, 'content.works.perma_delete', set))) {
      return { success: false, message: 'ลบถาวรได้เฉพาะ level 10 เท่านั้น (หรือที่ level 10 เปิดสิทธิ์ไว้ในหน้าตั้งค่า)' }
    }
    try {
      await permaDeleteWorkAdmin(BigInt(user.id), params.uuid)
      set.status = 204
    } catch (err: any) {
      const map: Record<string, { status: number; message: string }> = {
        WORK_NOT_FOUND:      { status: 404, message: 'ไม่พบผลงานนี้' },
        WORK_HAS_PURCHASES:  { status: 400, message: 'ผลงานนี้มีประวัติการซื้อจริงแล้ว ลบถาวรไม่ได้ ใช้ลบแบบซ่อน (soft delete) แทน' },
      }
      const matched = map[err.message]
      if (matched) { set.status = matched.status; return { success: false, message: matched.message } }
      throw err
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'ลบผลงานถาวร ย้อนคืนไม่ได้ (level 10 เท่านั้น)', tags: ['Admin'] },
  })
