// =============================================================
// Novel Platform — Writer Routes
// วางไว้ที่: apps/api/src/modules/writer/writer.routes.ts
// =============================================================

import Elysia, { t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import {
  getMyWorks,
  getWorkForEdit,
  createWork,
  updateWork,
  setWorkFeatured,
  deleteWork,
  getWorkStats,
  getWorkViewsMonthly,
  getWorkViewsYearly,
  getWorkTopEpisodes,
  uploadCover,
  getMyEpisodes,
  getEpisodeForEdit,
  createEpisode,
  updateEpisode,
  bulkUpdateEpisodeLabel,
  bulkUpdateEpisodePublish,
  bulkUpdateEpisodePrice,
  deleteEpisode,
  uploadEpisodeImages,
  deleteImage,
  autoChunkText,
  getWriterDashboard,
  getWriterOverviewStats,
  getWriterSalesMonthly,
  getWriterSalesYearly,
  getWriterSalesByYear,
  getWriterSalesHourly,
  getWriterSalesHistory,
  getWriterTopSellingWorks,
  requestWithdrawal,
  getWithdrawalHistory,
  getWithdrawOverview,
  getMyBankInfo,
  requestBankChange,
  getWriterReceivedReports,
  acknowledgeReport,
  getWriterAdminNotices,
  acknowledgeAdminNotice,
} from './writer.service'
import { startBulkEpisodeUpload, getBulkUploadJobStatus } from './writer.bulk-upload.service'
import { listAnnouncements } from '../admin/admin.service'
import { isAllowedImageType } from '../../lib/r2'
import { checkMangaImageUploadLimit, checkMultipartUploadLimit } from '../../lib/upload-rate-limit'
import { accountRateLimitRule, enforceRateLimit } from '../../lib/rate-limit'

const MAX_MANGA_IMAGES_PER_REQUEST = 80
const MAX_MANGA_UPLOAD_BYTES = 80 * 1024 * 1024


// ---- Helper: แปลง error message → HTTP response ----
// export ไว้ให้ admin-works.routes.ts เรียกใช้ร่วมกัน (delegate ไปที่ writer.service.ts ตัวเดียวกัน
// เลย error code ที่โยนออกมาเป็นชุดเดียวกันเป๊ะ ไม่ต้อง copy map นี้ซ้ำ)
export function handleServiceError(err: any, set: any) {
  const map: Record<string, { status: number; message: string }> = {
    WORK_NOT_FOUND:  { status: 404, message: 'ไม่พบผลงานนี้หรือไม่ใช่ของคุณ' },
    EPISODE_NOT_FOUND:  { status: 404, message: 'ไม่พบตอนนี้หรือไม่ใช่ของคุณ' },
    IMAGE_NOT_FOUND:    { status: 404, message: 'ไม่พบรูปภาพนี้' },
    COVER_REQUIRED:     { status: 400, message: 'ต้องอัปโหลด cover image ก่อน publish' },
    INVALID_FILE_TYPE:  { status: 400, message: 'รองรับเฉพาะ JPG, PNG, WebP เท่านั้น' },
    NOT_MANGA:          { status: 400, message: 'ตอนนี้เป็นนิยาย ไม่มีระบบอัปโหลดภาพ' },
    NO_IMAGES:          { status: 400, message: 'ต้องอัปโหลดภาพก่อน publish' },
    NO_CONTENT:         { status: 400, message: 'ต้องใส่เนื้อหาก่อน publish' },
    ONE_SHOT_LIMIT:     { status: 400, message: 'เรื่องนี้ตั้งเป็น one shot ไว้ มีได้แค่ตอนเดียวเท่านั้น' },
    INVALID_EP_NO:      { status: 400, message: 'เลขลำดับตอนต้องไม่ติดลบ' },
    EP_NO_TAKEN:        { status: 400, message: 'เลขลำดับตอนนี้ถูกใช้ไปแล้ว' },
    NOT_NOVEL:          { status: 400, message: 'ฟีเจอร์นี้ใช้ได้เฉพาะนิยาย (ไม่รองรับการ์ตูน)' },
    ZIP_TOO_LARGE:      { status: 400, message: 'ไฟล์ zip ต้องไม่เกิน 50MB' },
    INVALID_ZIP:        { status: 400, message: 'ไฟล์นี้ไม่ใช่ zip ที่ถูกต้อง' },
    TOO_MANY_FILES:     { status: 400, message: 'zip มีไฟล์เกิน 200 ไฟล์' },
    NO_VALID_FILES:     { status: 400, message: 'ไม่พบไฟล์ที่ตั้งชื่อถูกต้อง (ต้องเป็น N.txt/N.docx หรือ N_ชื่อตอน.txt/docx)' },
    JOB_NOT_FOUND:      { status: 404, message: 'ไม่พบงานอัปโหลดนี้' },
    INVALID_EP_NO_RANGE: { status: 400, message: 'ช่วงเลขตอนไม่ถูกต้อง (เลขเริ่มต้นต้องไม่ติดลบ และเลขสิ้นสุดต้องไม่น้อยกว่าเลขเริ่มต้น)' },
    SCHEDULE_DATETIME_REQUIRED: { status: 400, message: 'กรุณาเลือกวันเวลาที่จะเผยแพร่' },
    NO_EPISODES_SELECTED: { status: 400, message: 'ยังไม่ได้เลือกตอนไว้เลย' },
    TAG_QUOTA_EXCEEDED: { status: 400, message: 'สร้างหมวดหมู่ย่อยใหม่เกินโควต้าเดือนนี้แล้ว (สูงสุด 25 อันใหม่ต่อเดือน) ลองใช้หมวดหมู่ที่มีอยู่แล้วแทน' },
    FEATURED_LIMIT:     { status: 400, message: 'ตั้งนิยายแนะนำได้สูงสุด 8 เรื่องเท่านั้น' },
  }

  const matched = map[err.message]
  if (matched) {
    set.status = matched.status
    return { success: false, message: matched.message }
  }

  // error ที่ไม่รู้จัก → throw ต่อให้ Elysia จัดการ
  throw err
}

// =============================================================
// Writer Routes
// =============================================================

export const writerRoutes = new Elysia({ prefix: '/writer' })
  .use(authMiddleware)
  // เช็ค level ด้วย onBeforeHandle — รันหลัง derive ทุกตัว จึงเห็น user แน่นอน
  .onBeforeHandle(({ user, set }) => {
    if (user.level < 6) {
      set.status = 403
      return { success: false, message: 'ต้องเป็น Writer หรือ Admin เท่านั้น' }
    }
  })
  // Applies before request.formData(), so rejected attempts never reach Sharp or R2.
  .onBeforeHandle(async ({ user, request, set }) => {
    try {
      const result = await checkMultipartUploadLimit(request, user.id)
      if (result.allowed) return

      set.status = result.unavailable ? 503 : 429
      set.headers['Retry-After'] = String(result.retryAfterSeconds)
      return { success: false, message: result.unavailable ? 'ระบบตรวจสอบโควตาอัปโหลดไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' : 'อัปโหลดบ่อยเกินไป กรุณาลองใหม่ภายหลัง' }
    } catch (error) {
      console.error('[upload-rate-limit] writer upload denied:', error)
      set.status = 503
      return { success: false, message: 'ระบบตรวจสอบโควตาอัปโหลดไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' }
    }
  })
  // ตัว multipart ด้านบนเช็คเฉพาะ request ที่เป็น multipart/form-data (cover/รูปการ์ตูน/หลักฐาน
  // เปลี่ยนบัญชีธนาคาร) เท่านั้น — endpoint เขียนข้อมูล body เป็น JSON ในกลุ่มนี้ (สร้าง/แก้ผลงาน,
  // สร้าง/แก้ตอน, bulk actions, ขอถอนเงิน ฯลฯ) ไม่เคยมี rate limit เลยสักจุด (2026-08-18 เพิ่ม) —
  // ใช้ account limit เดียวครอบทุก POST/PATCH/PUT/DELETE ที่ไม่ใช่ multipart แทนที่จะไปแปะทีละ
  // endpoint 15 จุด (multipart เจอ rule ของตัวเองแล้วด้านบน ข้ามซ้ำไม่ต้องนับสองรอบ)
  .onBeforeHandle(async ({ user, request, set }) => {
    if (request.method === 'GET') return
    const contentType = request.headers.get('content-type') ?? ''
    if (contentType.toLowerCase().startsWith('multipart/form-data')) return

    const limited = await enforceRateLimit(set, [
      accountRateLimitRule('writer-mutation', user.id, 60, 10 * 60),
    ])
    if (limited) return limited
  })

  // --------------------------------------------------
  // GET /writer/dashboard
  // ดู stats ของตัวเอง: เหรียญ, ยอดขาย, จำนวนผลงาน
  // --------------------------------------------------
  .get('/dashboard', async ({ user }) => {
    const data = await getWriterDashboard(BigInt(user.id))
    return { success: true, data }
  }, {
    detail: { summary: 'Dashboard ของ Writer', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/overview/stats
  // สรุปยอดรวมทุกผลงาน — หน้า "ภาพรวมนักเขียน"
  // --------------------------------------------------
  .get('/overview/stats', async ({ user }) => {
    const data = await getWriterOverviewStats(BigInt(user.id))
    return { success: true, data }
  }, {
    detail: { summary: 'สรุปยอดรวมทุกผลงานของนักเขียน', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/overview/sales-monthly?year=2026&month=8
  // กราฟยอดขายรายวันภายในเดือนที่เลือก (รวมทุกผลงาน) — หน้า "ภาพรวมนักเขียน"
  // --------------------------------------------------
  .get('/overview/sales-monthly', async ({ user, query }) => {
    const data = await getWriterSalesMonthly(BigInt(user.id), query.year, query.month)
    return { success: true, data }
  }, {
    query: t.Object({
      year:  t.Numeric({ minimum: 2020, maximum: 2100 }),
      month: t.Numeric({ minimum: 1, maximum: 12 }),
    }),
    detail: { summary: 'กราฟยอดขายรายวันภายในเดือนที่เลือก', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/overview/sales-yearly?year=2026
  // กราฟยอดขายรายเดือนภายในปีที่เลือก — โหมด "รายเดือน"
  // --------------------------------------------------
  .get('/overview/sales-yearly', async ({ user, query }) => {
    const data = await getWriterSalesYearly(BigInt(user.id), query.year)
    return { success: true, data }
  }, {
    query: t.Object({ year: t.Numeric({ minimum: 2020, maximum: 2100 }) }),
    detail: { summary: 'กราฟยอดขายรายเดือนภายในปีที่เลือก', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/overview/sales-by-year
  // กราฟยอดขายรายปี ทุกปีที่มีข้อมูลจริง — โหมด "ตลอด"
  // --------------------------------------------------
  .get('/overview/sales-by-year', async ({ user }) => {
    const data = await getWriterSalesByYear(BigInt(user.id))
    return { success: true, data }
  }, {
    detail: { summary: 'กราฟยอดขายรายปี (ทุกปีที่มีข้อมูล)', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/overview/sales-hourly
  // กราฟยอดขายรายชั่วโมง 24 ชม.ล่าสุดแบบ rolling — โหมด "วัน" (ไม่มี parameter ย้อนหลัง)
  // --------------------------------------------------
  .get('/overview/sales-hourly', async ({ user }) => {
    const data = await getWriterSalesHourly(BigInt(user.id))
    return { success: true, data }
  }, {
    detail: { summary: 'กราฟยอดขายรายชั่วโมง 24 ชม.ล่าสุด', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/overview/sales-history?page=1&limit=10&search=xxx
  // "ประวัติรายได้ (ขาย)" — log รายทรานแซกชัน ค้นหาผู้ซื้อได้
  // --------------------------------------------------
  .get('/overview/sales-history', async ({ user, query }) => {
    const data = await getWriterSalesHistory(BigInt(user.id), query.page ?? 1, query.limit ?? 10, query.search)
    return { success: true, ...data }
  }, {
    query: t.Object({
      page:   t.Optional(t.Numeric({ minimum: 1 })),
      limit:  t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
      search: t.Optional(t.String({ maxLength: 100 })),
    }),
    detail: { summary: 'ประวัติรายได้ (ขาย) ค้นหาผู้ซื้อได้', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/overview/top-selling?period=7d|30d
  // "เรื่องขายดี" — จัดอันดับผลงานตัวเองตามยอดขายรวม 7/30 วันที่ผ่านมา (rolling window)
  // --------------------------------------------------
  .get('/overview/top-selling', async ({ user, query }) => {
    const data = await getWriterTopSellingWorks(BigInt(user.id), query.period, 10)
    return { success: true, data }
  }, {
    query: t.Object({ period: t.Union([t.Literal('7d'), t.Literal('30d')]) }),
    detail: { summary: 'เรื่องขายดีใน 7/30 วันที่ผ่านมา', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/works
  // รายการผลงานทั้งหมดของตัวเอง
  // --------------------------------------------------
  .get('/works', async ({ user }) => {
    const data = await getMyWorks(BigInt(user.id))
    return { success: true, data }
  }, {
    detail: { summary: 'รายการผลงานของฉัน', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/works/:uuid
  // ดูข้อมูลผลงานเรื่องเดียว (สำหรับหน้าแก้ไขนิยาย)
  // --------------------------------------------------
  .get('/works/:uuid', async ({ user, params, set }) => {
    try {
      const data = await getWorkForEdit(BigInt(user.id), params.uuid)
      return { success: true, data }
    } catch (err: any) {
      return handleServiceError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'ดูข้อมูลผลงานเรื่องเดียว', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // POST /writer/works
  // สร้างผลงานใหม่ (การ์ตูน/นิยาย)
  // --------------------------------------------------
  .post('/works', async ({ user, body, set }) => {
    try {
      const work = await createWork(BigInt(user.id), {
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
      return handleServiceError(err, set)
    }
  }, {
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
    detail: { summary: 'สร้างผลงานใหม่', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // PATCH /writer/works/:uuid
  // แก้ข้อมูลผลงาน
  // --------------------------------------------------
  .patch('/works/:uuid', async ({ user, params, body, set }) => {
    try {
      const updated = await updateWork(BigInt(user.id), params.uuid, {
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
    } catch (err: any) {
      return handleServiceError(err, set)
    }
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
    detail: { summary: 'แก้ข้อมูลผลงาน', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // PATCH /writer/works/:uuid/featured
  // ตั้ง/เอาออกจาก "นิยายแนะนำ" ในหน้าโปรไฟล์ (migration 021, 2026-07-29 — สูงสุด 8 เรื่อง)
  // --------------------------------------------------
  .patch('/works/:uuid/featured', async ({ user, params, body, set }) => {
    try {
      await setWorkFeatured(BigInt(user.id), params.uuid, body.featured)
      return { success: true }
    } catch (err: any) {
      return handleServiceError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({ featured: t.Boolean() }),
    detail: { summary: 'ตั้ง/เอาออกจากนิยายแนะนำ', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // DELETE /writer/works/:uuid
  // ลบผลงาน (soft delete)
  // --------------------------------------------------
  .delete('/works/:uuid', async ({ user, params, set }) => {
    try {
      await deleteWork(BigInt(user.id), params.uuid)
      set.status = 204
    } catch (err: any) {
      return handleServiceError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'ลบผลงาน (soft delete)', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/works/:uuid/stats
  // ดูสถิติผลงาน (ปุ่ม "สถิติ" ใน Dashboard)
  // --------------------------------------------------
  .get('/works/:uuid/stats', async ({ user, params, set }) => {
    try {
      const stats = await getWorkStats(BigInt(user.id), params.uuid)
      return { success: true, data: stats }
    } catch (err: any) {
      return handleServiceError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'ดูสถิติผลงาน', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/works/:uuid/stats/monthly?year=2026&month=8
  // กราฟยอดวิวรายวันภายในเดือนที่เลือก — แท็บ "สถิติเจาะลึก"
  // --------------------------------------------------
  .get('/works/:uuid/stats/monthly', async ({ user, params, query, set }) => {
    try {
      const data = await getWorkViewsMonthly(BigInt(user.id), params.uuid, query.year, query.month)
      return { success: true, data }
    } catch (err: any) {
      return handleServiceError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    query: t.Object({
      year:  t.Numeric({ minimum: 2020, maximum: 2100 }),
      month: t.Numeric({ minimum: 1, maximum: 12 }),
    }),
    detail: { summary: 'กราฟยอดวิวรายวันภายในเดือนที่เลือก', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/works/:uuid/stats/yearly?year=2026
  // กราฟยอดวิวรายเดือนภายในปีที่เลือก — แท็บ "สถิติเจาะลึก"
  // --------------------------------------------------
  .get('/works/:uuid/stats/yearly', async ({ user, params, query, set }) => {
    try {
      const data = await getWorkViewsYearly(BigInt(user.id), params.uuid, query.year)
      return { success: true, data }
    } catch (err: any) {
      return handleServiceError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    query: t.Object({ year: t.Numeric({ minimum: 2020, maximum: 2100 }) }),
    detail: { summary: 'กราฟยอดวิวรายเดือนภายในปีที่เลือก', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/works/:uuid/stats/top-episodes
  // 10 อันดับตอนที่มียอดวิวสูงสุด — แท็บ "สถิติเจาะลึก"
  // --------------------------------------------------
  .get('/works/:uuid/stats/top-episodes', async ({ user, params, set }) => {
    try {
      const data = await getWorkTopEpisodes(BigInt(user.id), params.uuid, 10)
      return { success: true, data }
    } catch (err: any) {
      return handleServiceError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: '10 อันดับตอนที่มียอดวิวสูงสุด', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // POST /writer/works/:uuid/cover
  // อัปโหลด cover image ขึ้น R2
  // รับ multipart/form-data
  //
  // ⚠️ ไม่ใช้ t.File() ใน schema เพราะ Elysia มีบั๊กรู้จักแล้ว (ดู elysiajs/elysia
  // issue #780, #1119, #782 — parse multipart file เป็น object ว่างเปล่าผิดพลาด)
  // เลย parse เองผ่าน request.formData() ตรงๆ แทน (Web API มาตรฐาน Bun รองรับถูกต้อง)
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
      const result = await uploadCover(
        BigInt(user.id),
        params.uuid,
        buffer,
        file.type,
        file.name
      )
      return { success: true, data: result }
    } catch (err: any) {
      return handleServiceError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'อัปโหลด cover image', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/works/:uuid/episodes
  // รายการตอนทั้งหมดของผลงานนี้
  // --------------------------------------------------
  .get('/works/:uuid/episodes', async ({ user, params, set }) => {
    try {
      const data = await getMyEpisodes(BigInt(user.id), params.uuid)
      return { success: true, data }
    } catch (err: any) {
      return handleServiceError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'รายการตอนของผลงาน', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // POST /writer/works/:uuid/episodes
  // สร้างตอนใหม่
  // --------------------------------------------------
  .post('/works/:uuid/episodes', async ({ user, params, body, set }) => {
    try {
      const episode = await createEpisode(BigInt(user.id), params.uuid, {
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
    } catch (err: any) {
      return handleServiceError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({
      ep_name:            t.String({ minLength: 1, maxLength: 200 }),
      ep_no:              t.Optional(t.Numeric({ minimum: 0 })),
      ep_price:           t.Optional(t.String()),
      publish_status:     t.Optional(t.String()),
      schedule_datetime:  t.Optional(t.String()),  // ISO date string
      lock_duration_days: t.Optional(t.Number()),
      reader_message:     t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
      image_protection:   t.Optional(t.Boolean()),
      episode_label:      t.Optional(t.Nullable(t.String({ maxLength: 30 }))),
      ep_content:         t.Optional(t.Any()),     // NovelBlock[] — validate ใน service
    }),
    detail: { summary: 'สร้างตอนใหม่', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // POST /writer/works/:uuid/episodes/bulk-upload
  // "เพิ่มอัตโนมัติ" — อัปโหลด zip หลายตอนพร้อมกัน
  //
  // ประมวลผลเบื้องหลัง (ไม่บล็อก request) — คืน job_id ทันที ให้ frontend poll
  // GET /writer/episode-uploads/:job_id เช็คความคืบหน้าต่อ
  // --------------------------------------------------
  .post('/works/:uuid/episodes/bulk-upload', async ({ user, params, request, set }) => {
    try {
      const formData = await request.formData()
      const file = formData.get('zip')
      const epPriceRaw = formData.get('ep_price')
      const publishStatusRaw = formData.get('publish_status')
      const scheduleDatetimeRaw = formData.get('schedule_datetime')
      const readerMessageRaw = formData.get('reader_message')
      const episodeLabelRaw = formData.get('episode_label')

      if (!(file instanceof File)) {
        set.status = 400
        return { success: false, message: 'ไม่พบไฟล์ zip' }
      }
      if (file.size > 50 * 1024 * 1024) {
        set.status = 400
        return { success: false, message: 'ไฟล์ zip ต้องไม่เกิน 50MB' }
      }
      if (epPriceRaw !== null && typeof epPriceRaw !== 'string') {
        set.status = 400
        return { success: false, message: 'ข้อมูลราคาตอนไม่ถูกต้อง' }
      }
      const epPrice = (epPriceRaw ?? '0').trim()
      if (!/^\d+$/.test(epPrice)) {
        set.status = 400
        return { success: false, message: 'ราคาเหรียญต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป' }
      }

      if (publishStatusRaw !== null && typeof publishStatusRaw !== 'string') {
        set.status = 400
        return { success: false, message: 'สถานะเผยแพร่ไม่ถูกต้อง' }
      }
      const publishStatus = publishStatusRaw || 'now'
      if (publishStatus !== 'now' && publishStatus !== 'schedule' && publishStatus !== 'hide') {
        set.status = 400
        return { success: false, message: 'สถานะเผยแพร่ไม่ถูกต้อง' }
      }

      let scheduleDatetime: Date | undefined
      if (publishStatus === 'schedule') {
        if (typeof scheduleDatetimeRaw !== 'string' || !scheduleDatetimeRaw) {
          set.status = 400
          return { success: false, message: 'กรุณาเลือกวันเวลาที่จะเผยแพร่' }
        }
        scheduleDatetime = new Date(scheduleDatetimeRaw)
        if (Number.isNaN(scheduleDatetime.getTime()) || scheduleDatetime.getTime() <= Date.now()) {
          set.status = 400
          return { success: false, message: 'วันเวลาเผยแพร่ต้องเป็นเวลาในอนาคต' }
        }
      }

      if (readerMessageRaw !== null && typeof readerMessageRaw !== 'string') {
        set.status = 400
        return { success: false, message: 'ข้อความถึงนักอ่านไม่ถูกต้อง' }
      }
      const readerMessage = readerMessageRaw?.trim() || null
      if (readerMessage && readerMessage.length > 200) {
        set.status = 400
        return { success: false, message: 'ข้อความถึงนักอ่านยาวได้ไม่เกิน 200 ตัวอักษร' }
      }

      if (episodeLabelRaw !== null && typeof episodeLabelRaw !== 'string') {
        set.status = 400
        return { success: false, message: 'คำเรียกตอนไม่ถูกต้อง' }
      }
      const episodeLabel = episodeLabelRaw?.trim() || null
      if (episodeLabel && episodeLabel.length > 30) {
        set.status = 400
        return { success: false, message: 'คำเรียกตอนยาวได้ไม่เกิน 30 ตัวอักษร' }
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const result = await startBulkEpisodeUpload(BigInt(user.id), params.uuid, buffer, {
        epPrice,
        publishStatus,
        scheduleDatetime,
        readerMessage,
        episodeLabel,
      })
      set.status = 202 // Accepted — งานยังทำอยู่เบื้องหลัง ยังไม่เสร็จตอนตอบกลับ
      return { success: true, data: result }
    } catch (err: any) {
      return handleServiceError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'เพิ่มหลายตอนพร้อมกันผ่าน zip (เพิ่มอัตโนมัติ)', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/episode-uploads/:job_id
  // เช็คความคืบหน้า job "เพิ่มอัตโนมัติ" (polling)
  // --------------------------------------------------
  .get('/episode-uploads/:job_id', async ({ user, params, set }) => {
    try {
      const status = await getBulkUploadJobStatus(BigInt(user.id), BigInt(params.job_id))
      return { success: true, data: status }
    } catch (err: any) {
      return handleServiceError(err, set)
    }
  }, {
    params: t.Object({ job_id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'เช็คความคืบหน้า "เพิ่มอัตโนมัติ"', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // PATCH /writer/works/:uuid/episodes/bulk-label
  // แก้ "คำเรียกตอน" หลายตอนพร้อมกัน (ปุ่มฟันเฟือง "ตั้งค่าพิเศษ")
  // เลือกตอนได้ 2 แบบ: ส่ง ep_ids มา = ใช้ตอนที่เลือกตรงๆ (sync กับ checkbox ในตาราง)
  // ไม่ส่ง ep_ids มา = ใช้ start_ep_no/end_ep_no แทน (กำหนดช่วง)
  // --------------------------------------------------
  .patch('/works/:uuid/episodes/bulk-label', async ({ user, params, body, set }) => {
    try {
      const result = await bulkUpdateEpisodeLabel(
        BigInt(user.id),
        params.uuid,
        {
          startEpNo: body.start_ep_no,
          endEpNo:   body.end_ep_no,
          epIds:     body.ep_ids?.map((id) => BigInt(id)),
        },
        body.episode_label,
      )
      return { success: true, data: result }
    } catch (err: any) {
      return handleServiceError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({
      start_ep_no:   t.Optional(t.Numeric({ minimum: 0 })),
      end_ep_no:     t.Optional(t.Numeric({ minimum: 0 })),
      ep_ids:        t.Optional(t.Array(t.String({ pattern: '^[0-9]+$' }))),
      episode_label: t.Nullable(t.String({ maxLength: 30 })),
    }),
    detail: { summary: 'แก้คำเรียกตอนหลายตอนพร้อมกัน (ช่วงเลขตอน หรือระบุตอนตรงๆ)', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // PATCH /writer/works/:uuid/episodes/bulk-publish
  // เผยแพร่ทันที / ตั้งเวลาเผยแพร่ หลายตอนพร้อมกัน (ปุ่มนาฬิกา)
  // เลือกตอนแบบเดียวกับ bulk-label — ep_ids ตรงๆ (sync checkbox) หรือช่วง start/end
  // ข้ามตอนที่ยังไม่มีเนื้อหา/รูปให้อัตโนมัติ (ดู bulkUpdateEpisodePublish())
  // --------------------------------------------------
  .patch('/works/:uuid/episodes/bulk-publish', async ({ user, params, body, set }) => {
    try {
      const result = await bulkUpdateEpisodePublish(
        BigInt(user.id),
        params.uuid,
        {
          startEpNo: body.start_ep_no,
          endEpNo:   body.end_ep_no,
          epIds:     body.ep_ids?.map((id) => BigInt(id)),
        },
        body.publish_status,
        body.schedule_datetime ? new Date(body.schedule_datetime) : undefined,
      )
      return { success: true, data: result }
    } catch (err: any) {
      return handleServiceError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({
      start_ep_no:       t.Optional(t.Numeric({ minimum: 0 })),
      end_ep_no:         t.Optional(t.Numeric({ minimum: 0 })),
      ep_ids:            t.Optional(t.Array(t.String({ pattern: '^[0-9]+$' }))),
      publish_status:    t.Union([t.Literal('now'), t.Literal('schedule')]),
      schedule_datetime: t.Optional(t.String()),
    }),
    detail: { summary: 'เผยแพร่ทันที/ตั้งเวลาเผยแพร่หลายตอนพร้อมกัน', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // PATCH /writer/works/:uuid/episodes/bulk-price
  // ตั้งราคาหลายตอนพร้อมกัน (ปุ่มเหรียญ) — เลือกได้แค่จาก checkbox ที่ตารางเลือกไว้เท่านั้น
  // --------------------------------------------------
  .patch('/works/:uuid/episodes/bulk-price', async ({ user, params, body, set }) => {
    try {
      const result = await bulkUpdateEpisodePrice(
        BigInt(user.id),
        params.uuid,
        body.ep_ids.map((id) => BigInt(id)),
        body.ep_price,
      )
      return { success: true, data: result }
    } catch (err: any) {
      return handleServiceError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({
      ep_ids:   t.Array(t.String({ pattern: '^[0-9]+$' }), { minItems: 1 }),
      ep_price: t.String(),
    }),
    detail: { summary: 'ตั้งราคาหลายตอนพร้อมกัน (ตามตอนที่ติ๊กเลือกไว้)', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/episodes/:ep_id
  // ดูข้อมูลตอนเดียวแบบเต็ม (สำหรับหน้าแก้ไขตอน)
  // --------------------------------------------------
  .get('/episodes/:ep_id', async ({ user, params, set }) => {
    try {
      const episode = await getEpisodeForEdit(BigInt(user.id), BigInt(params.ep_id))
      return { success: true, data: episode }
    } catch (err: any) {
      return handleServiceError(err, set)
    }
  }, {
    params: t.Object({ ep_id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'ดูข้อมูลตอนเดียวแบบเต็ม', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // PATCH /writer/episodes/:ep_id
  // แก้ข้อมูลตอน (ใช้ทั้ง manga และ novel)
  // --------------------------------------------------
  .patch('/episodes/:ep_id', async ({ user, params, body, set }) => {
    try {
      const epId   = BigInt(params.ep_id)
      const updated = await updateEpisode(BigInt(user.id), epId, {
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
    } catch (err: any) {
      return handleServiceError(err, set)
    }
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
    detail: { summary: 'แก้ข้อมูลตอน', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // DELETE /writer/episodes/:ep_id
  // ลบตอน (soft delete)
  // --------------------------------------------------
  .delete('/episodes/:ep_id', async ({ user, params, set }) => {
    try {
      await deleteEpisode(BigInt(user.id), BigInt(params.ep_id))
      set.status = 204
    } catch (err: any) {
      return handleServiceError(err, set)
    }
  }, {
    params: t.Object({ ep_id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'ลบตอน (soft delete)', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // POST /writer/episodes/:ep_id/images
  // อัปโหลดภาพ manga (รับหลายไฟล์พร้อมกันได้)
  //
  // ⚠️ ไม่ใช้ t.Files() ใน schema เพราะ Elysia มีบั๊กเดียวกับ t.File() (ดู comment
  // ที่ route /works/:uuid/cover ด้านบน) — parse เองผ่าน request.formData() แทน
  // --------------------------------------------------
  .post('/episodes/:ep_id/images', async ({ user, params, request, set }) => {
    try {
      const epId  = BigInt(params.ep_id)
      const formData = await request.formData()
      const files = formData.getAll('images').filter((f): f is File => f instanceof File)

      if (files.length === 0) {
        set.status = 400
        return { success: false, message: 'ไม่พบไฟล์ images' }
      }
      if (files.length > MAX_MANGA_IMAGES_PER_REQUEST) {
        set.status = 400
        return { success: false, message: `อัปโหลดได้สูงสุด ${MAX_MANGA_IMAGES_PER_REQUEST} รูปต่อครั้ง` }
      }
      if (files.some((f) => f.size > 10 * 1024 * 1024)) {
        set.status = 400
        return { success: false, message: 'แต่ละไฟล์ต้องไม่เกิน 10MB' }
      }
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
      if (totalBytes > MAX_MANGA_UPLOAD_BYTES) {
        set.status = 400
        return { success: false, message: 'ขนาดรูปทั้งหมดต้องไม่เกิน 80MB ต่อครั้ง' }
      }

      const imageLimit = await checkMangaImageUploadLimit(request, user.id, files.length)
      if (!imageLimit.allowed) {
        set.status = imageLimit.unavailable ? 503 : 429
        set.headers['Retry-After'] = String(imageLimit.retryAfterSeconds)
        return { success: false, message: imageLimit.unavailable ? 'ระบบตรวจสอบโควตาอัปโหลดไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' : 'อัปโหลดภาพการ์ตูนครบโควตาแล้ว กรุณาลองใหม่ภายหลัง' }
      }

      const prepared = await Promise.all(
        files.map(async (f) => ({
          buffer:      Buffer.from(await f.arrayBuffer()),
          contentType: f.type,
          filename:    f.name,
        }))
      )

      const inserted = await uploadEpisodeImages(BigInt(user.id), epId, prepared)
      set.status = 201
      return { success: true, data: inserted }
    } catch (err: any) {
      return handleServiceError(err, set)
    }
  }, {
    params: t.Object({ ep_id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'อัปโหลดภาพ manga', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // DELETE /writer/episodes/:ep_id/images/:image_id
  // ลบภาพ manga ออกจาก R2 และ DB
  // --------------------------------------------------
  .delete('/episodes/:ep_id/images/:image_id', async ({ user, params, set }) => {
    try {
      await deleteImage(BigInt(user.id), BigInt(params.image_id))
      set.status = 204
    } catch (err: any) {
      return handleServiceError(err, set)
    }
  }, {
    params: t.Object({
      ep_id:    t.String({ pattern: '^[0-9]+$' }),
      image_id: t.String({ pattern: '^[0-9]+$' }),
    }),
    detail: { summary: 'ลบภาพ manga', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // POST /writer/episodes/:ep_id/auto-chunk
  // หั่นข้อความนิยายเป็น blocks อัตโนมัติ
  // ไม่บันทึกทันที — return ให้ writer ดู preview ก่อน
  // writer ต้อง PATCH /writer/episodes/:ep_id เพื่อ save จริง
  // --------------------------------------------------
  .post('/episodes/:ep_id/auto-chunk', async ({ body }) => {
    const blocks = autoChunkText(body.raw_text)
    return {
      success: true,
      data: {
        blocks,
        block_count: blocks.length,
      },
    }
  }, {
    params: t.Object({ ep_id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Object({
      raw_text: t.String({ minLength: 1 }),
    }),
    detail: {
      summary: 'Auto-chunk ข้อความนิยายเป็น blocks (preview)',
      tags: ['Writer'],
    },
  })

  // --------------------------------------------------
  // POST /writer/withdrawals
  // ขอถอนเงิน — พิมพ์จำนวนเงินเอง (500-50,000 บาท) โอนเข้าบัญชีธนาคารที่ผูกไว้
  //
  // กฎ (migration 031 — เปลี่ยนจากเดิมที่ถอนยอด sales ทั้งหมดในครั้งเดียว):
  //   - amount ต้องอยู่ระหว่าง 500-50,000 บาท และไม่เกินยอดเงินคงเหลือ
  //   - ต้องมีบัญชีธนาคารที่ยืนยันแล้วก่อน (ดู POST /writer/bank-change-requests)
  //   - ต้องไม่มี pending withdrawal ค้างอยู่
  //   - ถอนฟรี 2 ครั้ง/เดือน เกินจากนั้นค่าธรรมเนียมคงที่ 20 บาท/ครั้ง
  // --------------------------------------------------
  .post('/withdrawals', async ({ user, body, set }) => {
    // นอกจาก account limit ทั่วไปของทั้งกลุ่ม (60/10นาที) เพิ่มลิมิตเฉพาะจุดนี้แคบกว่าอีกชั้น
    // เพราะเป็นจุดเงินโดยตรง — เข้าเกณฑ์เดียวกับ topup-initiate (5/15 นาที) ใน topup.routes.ts
    const limited = await enforceRateLimit(set, [
      accountRateLimitRule('writer-withdrawal', user.id, 5, 15 * 60),
    ])
    if (limited) return limited

    try {
      const data = await requestWithdrawal(BigInt(user.id), body.amount)
      set.status = 201
      return { success: true, data }
    } catch (err: any) {
      const map: Record<string, { status: number; message: string }> = {
        AMOUNT_OUT_OF_RANGE:       { status: 400, message: 'จำนวนเงินต้องอยู่ระหว่าง 500-50,000 บาท' },
        NO_BANK_ACCOUNT:           { status: 400, message: 'ยังไม่มีบัญชีธนาคารที่ยืนยันแล้ว กรุณาส่งคำขอผูกบัญชีก่อน' },
        INSUFFICIENT_BALANCE:      { status: 400, message: 'ยอดเงินคงเหลือไม่พอสำหรับจำนวนที่ขอถอน' },
        PENDING_WITHDRAWAL_EXISTS: { status: 400, message: 'มีคำขอถอนเงินที่รอดำเนินการอยู่แล้ว' },
        PENDING_INFO_EDIT:         { status: 403, message: 'มีการแก้ไขข้อมูลนักเขียนที่รอตรวจสอบอยู่ ไม่สามารถขอถอนเงินได้จนกว่าจะได้รับการยืนยัน' },
      }
      const matched = map[err.message]
      if (matched) {
        set.status = matched.status
        return { success: false, message: matched.message }
      }
      throw err
    }
  }, {
    body: t.Object({
      amount: t.Number({ minimum: 500, maximum: 50000 }),
    }),
    detail: { summary: 'ขอถอนเงิน', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/withdrawals
  // ประวัติการถอนเงินทั้งหมด (filter สถานะได้)
  // --------------------------------------------------
  .get('/withdrawals', async ({ user, query }) => {
    const data = await getWithdrawalHistory(
      BigInt(user.id),
      query.page  ?? 1,
      query.limit ?? 20,
      query.status,
    )
    return { success: true, ...data }
  }, {
    query: t.Object({
      page:   t.Optional(t.Numeric({ minimum: 1 })),
      limit:  t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
      status: t.Optional(t.Union([t.Literal('pending'), t.Literal('approved'), t.Literal('rejected')])),
    }),
    detail: { summary: 'ประวัติการถอนเงิน', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/withdrawals/overview
  // สรุปยอดสำหรับหน้า "ถอนเงิน" (ยอดเงินคงเหลือ / รอดำเนินการ / ถอนทั้งหมด)
  // --------------------------------------------------
  .get('/withdrawals/overview', async ({ user }) => {
    const data = await getWithdrawOverview(BigInt(user.id))
    return { success: true, data }
  }, {
    detail: { summary: 'สรุปยอดหน้าถอนเงิน', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/bank-info
  // ข้อมูลบัญชีธนาคารปัจจุบัน + โควตาการขอเปลี่ยน (2 ครั้ง/30 วัน)
  // --------------------------------------------------
  .get('/bank-info', async ({ user }) => {
    const data = await getMyBankInfo(BigInt(user.id))
    return { success: true, data }
  }, {
    detail: { summary: 'ข้อมูลบัญชีธนาคาร + โควตาการขอเปลี่ยน', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // POST /writer/bank-change-requests
  // ส่งคำขอตั้ง/เปลี่ยนบัญชีธนาคาร (แนบภาพสมุดบัญชี+บัตรประชาชน รอแอดมินอนุมัติ)
  // รับ multipart/form-data — ไม่ใช้ t.File() ในเหตุผลเดียวกับ /works/:uuid/cover ด้านบน
  // --------------------------------------------------
  .post('/bank-change-requests', async ({ user, request, set }) => {
    try {
      const formData = await request.formData()
      const file = formData.get('document')

      if (!(file instanceof File)) {
        set.status = 400
        return { success: false, message: 'ไม่พบไฟล์หลักฐาน (สมุดบัญชี+บัตรประชาชน)' }
      }
      if (!isAllowedImageType(file.type)) {
        set.status = 400
        return { success: false, message: 'รองรับเฉพาะ JPG, PNG, WebP เท่านั้น' }
      }
      if (file.size > 5 * 1024 * 1024) {
        set.status = 400
        return { success: false, message: 'ไฟล์ต้องไม่เกิน 5MB' }
      }

      const bankCode      = String(formData.get('bank_code') ?? '').trim()
      const accountName   = String(formData.get('account_name') ?? '').trim()
      const accountNumber = String(formData.get('account_number') ?? '').trim()
      const reason         = formData.get('reason')

      if (!bankCode || !accountName || !accountNumber) {
        set.status = 400
        return { success: false, message: 'กรุณากรอกธนาคาร ชื่อบัญชี และเลขบัญชีให้ครบ' }
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const data = await requestBankChange(
        BigInt(user.id),
        user.uuid,
        {
          bank_code:      bankCode,
          account_name:   accountName,
          account_number: accountNumber,
          reason:         typeof reason === 'string' && reason.trim() !== '' ? reason.trim() : undefined,
        },
        { buffer, contentType: file.type }
      )
      set.status = 201
      return { success: true, data }
    } catch (err: any) {
      const map: Record<string, { status: number; message: string }> = {
        INVALID_BANK_CODE:            { status: 400, message: 'ไม่พบธนาคารนี้ในระบบ' },
        PENDING_BANK_CHANGE_EXISTS:   { status: 400, message: 'มีคำขอเปลี่ยนบัญชีที่รอดำเนินการอยู่แล้ว' },
        BANK_CHANGE_QUOTA_EXCEEDED:   { status: 400, message: 'ขอเปลี่ยนบัญชีธนาคารครบโควตา 2 ครั้ง/30 วันแล้ว' },
      }
      const matched = map[err.message]
      if (matched) {
        set.status = matched.status
        return { success: false, message: matched.message }
      }
      throw err
    }
  }, {
    detail: { summary: 'ส่งคำขอตั้ง/เปลี่ยนบัญชีธนาคาร (multipart, field "document")', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/reports
  // รายงานที่ได้รับจากนักอ่าน (เฉพาะหมวด "รายงานความผิดพลาด" — ดู content_reports, migration 032)
  // --------------------------------------------------
  .get('/reports', async ({ user, query }) => {
    const data = await getWriterReceivedReports(BigInt(user.id), query.page ?? 1, query.limit ?? 20)
    return { success: true, ...data }
  }, {
    query: t.Object({
      page:  t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
    }),
    detail: { summary: 'รายงานที่ได้รับจากนักอ่าน', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // PATCH /writer/reports/:id/acknowledge
  // ตอบกลับสั้นๆ (หมายเหตุ) แสดงว่าเห็นรายงานแล้ว — ไม่เปลี่ยนสถานะรายงาน (แอดมินคุมอยู่)
  // --------------------------------------------------
  .patch('/reports/:id/acknowledge', async ({ user, params, body, set }) => {
    try {
      await acknowledgeReport(BigInt(user.id), BigInt(params.id), body.note)
      return { success: true }
    } catch (err: any) {
      const map: Record<string, { status: number; message: string }> = {
        REPORT_NOT_FOUND: { status: 404, message: 'ไม่พบรายงานนี้' },
        NOT_YOUR_REPORT:  { status: 403, message: 'ไม่ใช่รายงานของผลงานคุณ' },
        EMPTY_NOTE:       { status: 400, message: 'กรุณากรอกข้อความ' },
      }
      const matched = map[err.message]
      if (matched) { set.status = matched.status; return { success: false, message: matched.message } }
      throw err
    }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Object({ note: t.String({ minLength: 1, maxLength: 500 }) }),
    detail: { summary: 'ตอบกลับรายงานจากนักอ่านสั้นๆ (แสดงว่าเห็นแล้ว)', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/admin-notices
  // รายงาน/แจ้งเตือนที่แอดมินส่งถึงเราตรงๆ (writer_admin_notices, migration 032)
  // --------------------------------------------------
  .get('/admin-notices', async ({ user, query }) => {
    const [data, announcements] = await Promise.all([
      getWriterAdminNotices(BigInt(user.id), query.page ?? 1, query.limit ?? 20),
      listAnnouncements(false),
    ])
    return {
      success: true,
      ...data,
      // ข่าวสารเป็นสิ่งที่ระบบส่งถึงนักเขียนทุกคน จึงแสดงร่วมในแท็บรายงานจากแอดมิน
      // โดยไม่ต้อง fan-out rows ไปทุกบัญชีและไม่ทำให้ข้อมูลซ้ำ
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        sender_name: a.created_by_name,
        created_at: a.created_at,
      })),
    }
  }, {
    query: t.Object({
      page:  t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
    }),
    detail: { summary: 'รายงานจากแอดมินที่ส่งถึงเราตรงๆ', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // PATCH /writer/admin-notices/:id/acknowledge
  // --------------------------------------------------
  .patch('/admin-notices/:id/acknowledge', async ({ user, params, body, set }) => {
    try {
      await acknowledgeAdminNotice(BigInt(user.id), BigInt(params.id), body.note)
      return { success: true }
    } catch (err: any) {
      const map: Record<string, { status: number; message: string }> = {
        NOTICE_NOT_FOUND: { status: 404, message: 'ไม่พบรายงานนี้' },
        NOT_YOUR_NOTICE:  { status: 403, message: 'ไม่ใช่รายงานที่ส่งถึงคุณ' },
        EMPTY_NOTE:       { status: 400, message: 'กรุณากรอกข้อความ' },
      }
      const matched = map[err.message]
      if (matched) { set.status = matched.status; return { success: false, message: matched.message } }
      throw err
    }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Object({ note: t.String({ minLength: 1, maxLength: 500 }) }),
    detail: { summary: 'ตอบกลับรายงานจากแอดมินสั้นๆ (แสดงว่าเห็นแล้ว)', tags: ['Writer'] },
  })

  // --------------------------------------------------
  // GET /writer/announcements
  // ข่าวสาร — ห่อ listAnnouncements() เดิม (admin.service.ts) แต่เปิดให้นักเขียนอ่านได้ (เดิมมีแค่
  // ฝั่งแอดมิน level >= 9 เท่านั้นที่เรียกได้) แสดงเฉพาะ status='active' เสมอ (includeInactive=false)
  // --------------------------------------------------
  .get('/announcements', async () => {
    const data = await listAnnouncements(false)
    return {
      success: true,
      data: data.map((a) => ({
        id: a.id,
        title: a.title,
        content: a.content,
        created_at: a.created_at,
        created_by_name: a.created_by_name,
      })),
    }
  }, {
    detail: { summary: 'ข่าวสารที่เผยแพร่อยู่ (active เท่านั้น)', tags: ['Writer'] },
  })
