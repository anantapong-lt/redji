// =============================================================
// Novel Platform — Admin Routes
// วางไว้ที่: apps/api/src/modules/admin/admin.routes.ts
// =============================================================
//
// ทุก endpoint ใน /admin ต้องการ level >= 9 (Admin)
// เช็คด้วย onBeforeHandle หลัง authMiddleware
// =============================================================

import Elysia, { t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { checkMultipartUploadLimit } from '../../lib/upload-rate-limit'
import { isAllowedImageType } from '../../lib/r2'
import { requirePermission, PERMISSION_DENIED_MESSAGE } from '../../lib/permission-guard'
import { hasPermission } from './admin-permissions.service'
import {
  listUsers, getUserDetail, setUserLevel, banUser, unbanUser,
  suspendActivity, liftActivitySuspension, suspendSpending, liftSpendSuspension, permaDeleteUser,
  createUserFlag, listUserFlags, reviewUserFlag,
  getUserSpendingSeries, getUserLoginRecords, getUserTopupRecords,
  getUserCommentRecords, getUserReadingRecords,
  createAdminActionRequest, listAdminActionRequests,
  approveAdminActionRequest, rejectAdminActionRequest,
  listWriterApplications, approveWriterApplication, rejectWriterApplication,
  getWriterApplicationForUser, getWriterWorksList,
  getWriterRevenueRate, getWriterRevenueSummary, setWriterRevenueRate,
  listContentReports, resolveContentReport, dismissContentReport,
  listWithdrawals, approveWithdrawal, rejectWithdrawal,
  listBankChangeRequests, approveBankChangeRequest, rejectBankChangeRequest,
  listCarousels, createCarousel, updateCarousel, deleteCarousel, reorderCarousels,
  listFeaturedWorks, addFeaturedWork, removeFeaturedWork, reorderFeaturedWorks, getFeaturedPreview,
  FEATURED_RECOMMENDED_MAX,
  listAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement,
  listWriterMessageRecipients, createDirectWriterMessage, listWriterMessageHistory,
  getWebSettings, updateWebSettings,
  getAuditLogs, getAuditLogEventTypes,
  type CarouselInput,
} from './admin.service'
import {
  getCategoriesAdmin, createCategory, updateCategory, deleteCategory,
} from '../works/works.service'

// 2026-08-06 user ขอปรับจาก 5MB → 15MB (ไฟล์ต้นฉบับเท่าไหร่ก็ตาม ท้ายที่สุดโดน sharp resize+
// บีบเป็น WebP ~1920×800 อยู่ดี ดู lib/image.ts — เพดานนี้กันแค่ไฟล์ที่ใหญ่เกินเหตุจริงๆ)
const CAROUSEL_MAX_FILE_SIZE_MB = 15
const CAROUSEL_MAX_FILE_SIZE = CAROUSEL_MAX_FILE_SIZE_MB * 1024 * 1024

// ---- Helper: ดึง field carousel จาก FormData → CarouselInput (ใช้ร่วม POST/PATCH multipart) ----
function parseCarouselFields(formData: FormData): CarouselInput & { title?: string } {
  const get = (key: string) => {
    const v = formData.get(key)
    return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined
  }
  return {
    title:            get('title'),
    subtitle:         get('subtitle') ?? null,
    link_url:         get('link_url') ?? null,
    sort_order:       get('sort_order') !== undefined ? Number(get('sort_order')) : undefined,
    status:           get('status') as 'active' | 'inactive' | undefined,
    start_at:         get('start_at') ? new Date(get('start_at')!) : undefined,
    end_at:           get('end_at') ? new Date(get('end_at')!) : (formData.has('end_at') ? null : undefined),
    display_seconds:  get('display_seconds'),
    note:             get('note') ?? null,
  }
}

// ---- Helper: แปลง error → HTTP response ----
function handleAdminError(err: any, set: any) {
  const map: Record<string, { status: number; message: string }> = {
    USER_NOT_FOUND:            { status: 404, message: 'ไม่พบผู้ใช้นี้' },
    WORK_NOT_FOUND:            { status: 404, message: 'ไม่พบผลงานนี้' },
    CANNOT_EDIT_SELF:          { status: 400, message: 'ไม่สามารถแก้ไข account ตัวเองได้' },
    CANNOT_BAN_SELF:           { status: 400, message: 'ไม่สามารถ ban ตัวเองได้' },
    CANNOT_MODERATE_HIGHER_LEVEL: { status: 403, message: 'ไม่สามารถทำรายการนี้กับผู้ใช้ที่ level เท่ากับหรือสูงกว่าตัวเองได้' },
    CANNOT_FLAG_ADMIN:         { status: 403, message: 'ไม่สามารถ flag แอดมินด้วยกันได้ — ระบบนี้มีไว้สำหรับผู้ใช้ทั่วไปเท่านั้น' },
    ALREADY_BANNED:            { status: 400, message: 'ผู้ใช้นี้ถูก ban อยู่แล้ว' },
    NOT_BANNED:                { status: 400, message: 'ผู้ใช้นี้ไม่ได้ถูก ban อยู่' },
    LEVEL_NOT_ALLOWED:         { status: 403, message: 'ไม่มีสิทธิ์ตั้ง level นี้ — ต้องส่งคำขอแทน' },
    REQUEST_ALREADY_PENDING:   { status: 400, message: 'มีคำขอที่รอดำเนินการอยู่แล้วสำหรับผู้ใช้นี้' },
    REQUEST_NOT_FOUND:         { status: 404, message: 'ไม่พบคำขอนี้' },
    REQUEST_NOT_PENDING:       { status: 400, message: 'คำขอนี้ถูกดำเนินการไปแล้ว' },
    INSUFFICIENT_LEVEL:        { status: 403, message: 'level ไม่พอสำหรับอนุมัติคำขอนี้' },
    APPLICATION_NOT_FOUND:     { status: 404, message: 'ไม่พบคำขอเป็นนักเขียนนี้' },
    APPLICATION_NOT_PENDING:   { status: 400, message: 'คำขอนี้ถูกดำเนินการไปแล้ว' },
    CANNOT_APPROVE_SELF:       { status: 400, message: 'ไม่สามารถอนุมัติคำขอเป็นนักเขียนของตัวเองได้ — ต้องให้แอดมินคนอื่นอนุมัติ' },
    REPORT_NOT_FOUND:          { status: 404, message: 'ไม่พบรายงานนี้' },
    REPORT_NOT_PENDING:        { status: 400, message: 'รายงานนี้ถูกตรวจสอบไปแล้ว' },
    WITHDRAWAL_NOT_FOUND:      { status: 404, message: 'ไม่พบคำขอถอนเงินนี้' },
    WITHDRAWAL_NOT_PENDING:    { status: 400, message: 'คำขอนี้ไม่ได้อยู่ในสถานะ pending' },
    BANK_CHANGE_REQUEST_NOT_FOUND:   { status: 404, message: 'ไม่พบคำขอเปลี่ยนบัญชีธนาคารนี้' },
    BANK_CHANGE_REQUEST_NOT_PENDING: { status: 400, message: 'คำขอนี้ไม่ได้อยู่ในสถานะ pending' },
    CAROUSEL_NOT_FOUND:        { status: 404, message: 'ไม่พบ carousel นี้' },
    INVALID_FILE_TYPE:         { status: 400, message: 'รองรับเฉพาะ JPG, PNG, WebP เท่านั้น' },
    ALREADY_FEATURED:          { status: 400, message: 'เรื่องนี้ถูกบูสต์อยู่ในคอลัมน์นี้แล้ว' },
    WORK_NOT_PUBLISHED:        { status: 400, message: 'เรื่องนี้ยังไม่เผยแพร่ บูสต์ไม่ได้ (จะไม่โผล่หน้าเว็บจริงอยู่ดี)' },
    FEATURED_WORK_NOT_FOUND:   { status: 404, message: 'ไม่พบรายการบูสต์นี้' },
    ANNOUNCEMENT_NOT_FOUND:    { status: 404, message: 'ไม่พบประกาศนี้' },
    CATEGORY_NOT_FOUND:        { status: 404, message: 'ไม่พบหมวดหมู่นี้' },
    CATEGORY_NAME_TAKEN:       { status: 400, message: 'มีหมวดหมู่ชื่อนี้อยู่แล้ว' },
    CATEGORY_IN_USE:           { status: 400, message: 'มีนิยายใช้หมวดหมู่นี้อยู่ ลบไม่ได้ ปิดการมองเห็นแทนได้' },
    WRITER_RECIPIENT_NOT_FOUND:{ status: 404, message: 'ไม่พบนักเขียนผู้รับข้อความนี้' },
    EMPTY_SUBJECT:             { status: 400, message: 'กรุณากรอกหัวข้อ' },
    EMPTY_MESSAGE:             { status: 400, message: 'กรุณากรอกรายละเอียดข้อความ' },
    ALREADY_ACTIVITY_SUSPENDED: { status: 400, message: 'ผู้ใช้นี้ถูกระงับการเคลื่อนไหวอยู่แล้ว' },
    NOT_ACTIVITY_SUSPENDED:     { status: 400, message: 'ผู้ใช้นี้ไม่ได้ถูกระงับการเคลื่อนไหวอยู่' },
    ALREADY_SPEND_SUSPENDED:    { status: 400, message: 'ผู้ใช้นี้ถูกระงับการใช้จ่ายอยู่แล้ว' },
    NOT_SPEND_SUSPENDED:        { status: 400, message: 'ผู้ใช้นี้ไม่ได้ถูกระงับการใช้จ่ายอยู่' },
    ALREADY_DELETED:            { status: 400, message: 'บัญชีนี้ถูกลบไปแล้ว' },
    FLAG_ALREADY_PENDING:       { status: 400, message: 'คุณ flag เรื่องนี้กับผู้ใช้นี้ไปแล้ว กำลังรอดำเนินการ' },
    FLAG_NOT_FOUND:             { status: 404, message: 'ไม่พบ flag นี้' },
    FLAG_NOT_PENDING:           { status: 400, message: 'flag นี้ถูกดำเนินการไปแล้ว' },
    REVENUE_RATE_OUT_OF_RANGE:  { status: 400, message: 'ค่าที่ตั้งเกินช่วงที่ปรับได้ (±8 percentage point จากค่ากลาง)' },
  }

  const matched = map[err.message]
  if (matched) {
    set.status = matched.status
    return { success: false, message: matched.message }
  }
  throw err
}

// level 8 ไม่เห็น "ใช้เงินรวมไปเท่าไหร่" (มติ 2026-07-30, ข้อ 2.1) — เอา field รวมยอดใช้จ่าย
// ออกจาก response เลย (ไม่ใช่แค่ซ่อนฝั่ง frontend) เหรียญที่ถือ (point) ยังเห็นได้ปกติ ไม่ถือเป็น
// "ข้อมูลการเงิน" ในความหมายนี้ (เป็น field พื้นฐานของบัญชี ไม่ใช่ประวัติการใช้จ่าย)
function stripFinancialFields<T extends { coins_spent_week?: unknown; coins_spent_month?: unknown }>(
  row: T,
  level: number,
): T {
  if (level >= 9) return row
  const { coins_spent_week, coins_spent_month, ...rest } = row
  return rest as T
}

// =============================================================
// Admin Routes — /admin
// =============================================================

export const adminRoutes = new Elysia({ prefix: '/admin' })
  .use(authMiddleware)
  // ❗ Admin-only gate — level < 8 = ไม่ใช่ admin เลย → 403 ทันที
  // 2026-07-30 มติเลเวล: 8=แอดมินย่อย (อนุมัตินักเขียน/ถอนเงิน/ส่งคำขอแบน), 9=แอดมินรอง
  // (แบนตรงได้ + ส่งคำขอเพิ่ม level 8), 10=shareholder (สิทธิ์เต็มไม่ต้องขออนุมัติใคร)
  // แต่ละ route ด้านล่างเช็ค level ละเอียดกว่านี้อีกทีตามความละเอียดอ่อนของ action นั้นๆ
  .onBeforeHandle(({ user, set }) => {
    if (user.level < 8) {
      set.status = 403
      return { success: false, message: 'ต้องเป็น Admin เท่านั้น' }
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
      console.error('[upload-rate-limit] admin upload denied:', error)
      set.status = 503
      return { success: false, message: 'ระบบตรวจสอบโควตาอัปโหลดไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง' }
    }
  })

  // ============================================================
  // User Management
  // ============================================================

  // --------------------------------------------------
  // GET /admin/users
  // รายการ user ทั้งหมด (paginated + searchable)
  //
  // Query:
  //   search       — ค้นหาชื่อ/email/username
  //   level        — กรองตาม level ตรงเป๊ะ (1-10)
  //   min_level    — กรอง "level >= ค่านี้" (ใช้กับค้นหาแอดมิน min_level=8 ในหน้า "ข้อมูลบัญชีแอดมิน")
  //   is_banned    — กรองเฉพาะที่โดน ban หรือไม่ (true/false)
  //   writers_only — เฉพาะแท็บ "นักเขียนของเว็บ": (level 6-7) OR มีผลงาน active จริง (2026-08-04)
  // --------------------------------------------------
  .get('/users', async ({ user, query }) => {
    const data = await listUsers({
      page:         query.page  ?? 1,
      limit:        query.limit ?? 20,
      search:       query.search,
      level:        query.level,
      min_level:    query.min_level,
      is_banned:    query.is_banned,
      writers_only: query.writers_only,
    })
    return { success: true, ...data, data: data.data.map((row) => stripFinancialFields(row, user.level)) }
  }, {
    query: t.Object({
      page:         t.Optional(t.Numeric({ minimum: 1 })),
      limit:        t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      search:       t.Optional(t.String({ maxLength: 100 })),
      level:        t.Optional(t.Numeric({ minimum: 1, maximum: 10 })),
      min_level:    t.Optional(t.Numeric({ minimum: 1, maximum: 10 })),
      is_banned:    t.Optional(t.BooleanString()),
      writers_only: t.Optional(t.BooleanString()),
    }),
    detail: { summary: 'รายการ user ทั้งหมด', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // GET /admin/users/:uuid
  // รายละเอียด user + สถานะ ban
  // --------------------------------------------------
  .get('/users/:uuid', async ({ user, params, set }) => {
    try {
      const data = await getUserDetail(params.uuid)
      return { success: true, data: stripFinancialFields(data, user.level) }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'รายละเอียด user', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // GET /admin/users/:uuid/writer-application — ใบสมัครนักเขียนล่าสุดของคนนี้ (ปุ่ม "ดูเพิ่มเติม"
  // ในตาราง "นักเขียนของเว็บ") null ถ้าไม่เคยสมัคร
  // --------------------------------------------------
  .get('/users/:uuid/writer-application', async ({ params, set }) => {
    try {
      const data = await getWriterApplicationForUser(params.uuid)
      return { success: true, data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'ใบสมัครนักเขียนล่าสุดของ user คนนี้', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // GET /admin/users/:uuid/works — รายชื่อผลงานของนักเขียนคนนี้ (ปุ่ม "ดูเพิ่มเติม")
  // --------------------------------------------------
  .get('/users/:uuid/works', async ({ params, query, set }) => {
    try {
      const data = await getWriterWorksList(params.uuid, query.page ?? 1, query.limit ?? 20)
      return { success: true, ...data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    query: t.Object({
      page:  t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
    }),
    detail: { summary: 'รายชื่อผลงานของ user คนนี้', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // GET /admin/users/:uuid/revenue-rate — ส่วนแบ่งรายได้ปัจจุบัน (2026-08-05, ใหม่)
  // ดูได้ level >= 8 (เหมือน writer-application/works ด้านบน) แก้ได้เฉพาะ level >= 9 (ดู PATCH ล่าง)
  // --------------------------------------------------
  .get('/users/:uuid/revenue-rate', async ({ params, set }) => {
    try {
      const data = await getWriterRevenueRate(params.uuid)
      return { success: true, data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'ดูส่วนแบ่งรายได้ปัจจุบันของนักเขียนคนนี้', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // GET /admin/users/:uuid/revenue-summary — ยอดขายจริงจาก ep_shop (ไม่ใช่ยอดคงเหลือรอถอน)
  // --------------------------------------------------
  .get('/users/:uuid/revenue-summary', async ({ params, set }) => {
    try {
      const data = await getWriterRevenueSummary(params.uuid)
      return { success: true, data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'สรุปยอดซื้อด้วยเหรียญและรายได้เว็บของนักเขียน', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // PATCH /admin/users/:uuid/revenue-rate — ปรับส่วนแบ่งรายได้ (level >= 9 เท่านั้น)
  // ปรับได้ ±8 percentage point จาก baseline เดิม (มติ 2026-08-03) — ส่ง rate_percent: null
  // เพื่อรีเซ็ตกลับไปใช้ค่ากลาง
  // --------------------------------------------------
  .patch('/users/:uuid/revenue-rate', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'economy.revenue_rate.edit', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      const data = await setWriterRevenueRate(BigInt(user.id), params.uuid, body.rate_percent)
      return { success: true, data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({ rate_percent: t.Nullable(t.Number({ minimum: 0, maximum: 100 })) }),
    detail: { summary: 'ปรับส่วนแบ่งรายได้ของนักเขียนคนนี้ (level >= 9)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // PATCH /admin/users/:uuid/level
  // เปลี่ยน level ผู้ใช้ — level 8/9 ตั้งได้แค่ 1 หรือ 6 (โซนนักอ่าน/นักเขียน) เท่านั้น
  // จะแตะ 8/9/10 ตรงๆ ไม่ได้เลยไม่ว่ากรณีใด (ต้องผ่าน /admin/level8-requests หรือเป็น
  // level 10 เท่านั้น) — setUserLevel() เช็คซ้ำอีกชั้นในนี้ ไม่ได้เชื่อ validation ฝั่งนี้อย่างเดียว
  //
  // ❗ Security: endpoint นี้ Admin-only อย่างเด็ดขาด ห้ามย้ายมาที่ user routes ไม่ว่าจะเหตุผลใดก็ตาม
  // --------------------------------------------------
  .patch('/users/:uuid/level', async ({ user, params, body, set }) => {
    try {
      await setUserLevel(BigInt(user.id), user.level, params.uuid, body.level)
      return { success: true, message: `เปลี่ยน level เป็น ${body.level} แล้ว` }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    body:   t.Object({ level: t.Number({ minimum: 1, maximum: 10 }) }),
    detail: { summary: 'เปลี่ยน level ผู้ใช้ (1/6/7 เท่านั้นถ้าไม่ใช่ level 10)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // POST /admin/users/:uuid/ban
  // Ban user ตรงๆ ทันที — ต้อง level >= 9 เท่านั้น (level 8 ต้องส่งคำขอผ่าน
  // /admin/ban-requests แทน ให้ level 9 ขึ้นไปอนุมัติก่อน)
  // --------------------------------------------------
  .post('/users/:uuid/ban', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'moderation.user.ban', set))) {
      return { success: false, message: 'level 8 ต้องส่งคำขอแบนผ่าน /admin/ban-requests แทน (หรือให้ level 10 เปิดสิทธิ์นี้ในหน้าตั้งค่า)' }
    }
    try {
      await banUser(BigInt(user.id), user.level, params.uuid, body.reason)
      return { success: true, message: 'Ban ผู้ใช้แล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({
      reason: t.String({ minLength: 1, maxLength: 500 }),
    }),
    detail: { summary: 'Ban ผู้ใช้ตรงๆ (level >= 9)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // DELETE /admin/users/:uuid/ban
  // Unban user (ยกเลิก ban ที่กำลัง active อยู่) — level >= 9 เท่านั้น
  // --------------------------------------------------
  .delete('/users/:uuid/ban', async ({ user, params, set }) => {
    if (!(await requirePermission(user, 'moderation.user.ban', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await unbanUser(BigInt(user.id), params.uuid)
      return { success: true, message: 'Unban ผู้ใช้แล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'Unban ผู้ใช้', tags: ['Admin'] },
  })

  // ============================================================
  // Suspensions — "ระงับการเคลื่อนไหว" / "ระงับการใช้จ่ายและเติมเงิน" (migration 027)
  // ซ้อนกับแบน/กันเองได้พร้อมกัน (มติ 2026-07-30) — level >= 9 ทำตรงได้เลย level 8 ต้อง Flag แทน
  // (ดู POST /users/:uuid/flag ด้านล่าง)
  // ============================================================

  .post('/users/:uuid/suspend-activity', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'moderation.user.suspend_activity', set))) {
      return { success: false, message: 'ไม่มีสิทธิ์ทำรายการนี้ — level 8 ใช้ Flag แทนได้ (หรือให้ level 10 เปิดสิทธิ์นี้ในหน้าตั้งค่า)' }
    }
    try {
      await suspendActivity(BigInt(user.id), user.level, params.uuid, body.reason)
      return { success: true, message: 'ระงับการเคลื่อนไหวแล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({ reason: t.String({ minLength: 1, maxLength: 500 }) }),
    detail: { summary: 'ระงับการเคลื่อนไหวผู้ใช้ (level >= 9)', tags: ['Admin'] },
  })

  .delete('/users/:uuid/suspend-activity', async ({ user, params, set }) => {
    if (!(await requirePermission(user, 'moderation.user.suspend_activity', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await liftActivitySuspension(BigInt(user.id), params.uuid)
      return { success: true, message: 'ยกเลิกการระงับการเคลื่อนไหวแล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'ยกเลิกระงับการเคลื่อนไหว (level >= 9)', tags: ['Admin'] },
  })

  .post('/users/:uuid/suspend-spending', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'moderation.user.suspend_spending', set))) {
      return { success: false, message: 'ไม่มีสิทธิ์ทำรายการนี้ — level 8 ใช้ Flag แทนได้ (หรือให้ level 10 เปิดสิทธิ์นี้ในหน้าตั้งค่า)' }
    }
    try {
      await suspendSpending(BigInt(user.id), user.level, params.uuid, body.reason)
      return { success: true, message: 'ระงับการใช้จ่ายและเติมเงินแล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({ reason: t.String({ minLength: 1, maxLength: 500 }) }),
    detail: { summary: 'ระงับการใช้จ่าย+เติมเงิน (level >= 9)', tags: ['Admin'] },
  })

  .delete('/users/:uuid/suspend-spending', async ({ user, params, set }) => {
    if (!(await requirePermission(user, 'moderation.user.suspend_spending', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await liftSpendSuspension(BigInt(user.id), params.uuid)
      return { success: true, message: 'ยกเลิกการระงับการใช้จ่ายแล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'ยกเลิกระงับการใช้จ่าย (level >= 9)', tags: ['Admin'] },
  })

  // ============================================================
  // ลบบัญชีถาวร — level 10 เท่านั้น เสมอ (มติ 2026-07-30 — level 9 ห้ามทำแม้แต่ผ่านการรีวิว flag)
  // ============================================================

  .post('/users/:uuid/perma-delete', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'moderation.user.perma_delete', set))) {
      return { success: false, message: 'ลบบัญชีถาวรได้เฉพาะ level 10 เท่านั้น (หรือที่ level 10 เปิดสิทธิ์ไว้ในหน้าตั้งค่า)' }
    }
    try {
      await permaDeleteUser(BigInt(user.id), user.level, params.uuid, body.reason)
      return { success: true, message: 'ลบบัญชีถาวรแล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({ reason: t.String({ minLength: 1, maxLength: 500 }) }),
    detail: { summary: 'ลบบัญชีถาวร — anonymize (level 10)', tags: ['Admin'] },
  })

  // ============================================================
  // Level-8 Flag System — level 8 flag เครื่องมือ 4 อย่างแทนการกดตรงๆ, level >= 9 รีวิว/execute
  // เองได้ทันที (ยกเว้น delete ต้อง level 10) ดูรายละเอียดเกณฑ์ auto-execute ใน admin.service.ts
  // ============================================================

  .post('/users/:uuid/flag', async ({ user, params, body, set }) => {
    try {
      const data = await createUserFlag({
        flaggedBy: BigInt(user.id),
        targetUserUuid: params.uuid,
        actionType: body.action_type,
        reason: body.reason,
      })
      set.status = 201
      return { success: true, data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({
      action_type: t.Union([
        t.Literal('suspend_activity'), t.Literal('suspend_spending'),
        t.Literal('ban'), t.Literal('delete'),
      ]),
      reason: t.String({ minLength: 1, maxLength: 500 }),
    }),
    detail: { summary: 'Flag ผู้ใช้ (level 8 ขึ้นไป — level 8 ทำได้แค่นี้)', tags: ['Admin'] },
  })

  .get('/users/flags', async ({ query }) => {
    const data = await listUserFlags({
      status: query.status as 'pending' | 'auto_executed' | 'executed' | 'dismissed' | undefined,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    })
    return { success: true, ...data }
  }, {
    // level >= 8 ดูได้ (base gate ของ /admin เช็คแล้ว) — level 8 ต้องเห็น flag ที่มีอยู่แล้วเพื่อ
    // ตัดสินใจว่าจะช่วย flag ซ้ำ (corroborate) ไหม ไม่ใช่แค่ level 9+ เท่านั้นที่ดูได้
    query: t.Object({
      status: t.Optional(t.Union([
        t.Literal('pending'), t.Literal('auto_executed'), t.Literal('executed'), t.Literal('dismissed'),
      ])),
      page:  t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
    }),
    detail: { summary: 'รายการ flag ผู้ใช้ (level >= 8)', tags: ['Admin'] },
  })

  .patch('/users/flags/:id/execute', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'moderation.flag.review', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await reviewUserFlag(BigInt(user.id), user.level, BigInt(params.id), 'execute', body?.note)
      return { success: true, message: 'ดำเนินการตาม flag แล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Optional(t.Object({ note: t.Optional(t.String({ maxLength: 500 })) })),
    detail: { summary: 'Execute flag ทันที (level >= 9, delete ต้อง level 10)', tags: ['Admin'] },
  })

  .patch('/users/flags/:id/dismiss', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'moderation.flag.review', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await reviewUserFlag(BigInt(user.id), user.level, BigInt(params.id), 'dismiss', body.note)
      return { success: true, message: 'ยกเลิก flag แล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Object({ note: t.String({ minLength: 1, maxLength: 500 }) }),
    detail: { summary: 'ยกเลิก flag ผู้ใช้ (level >= 9)', tags: ['Admin'] },
  })

  // ============================================================
  // User Detail — Dynamic Tabs (migration 027) — level 8 มีข้อจำกัด: ไม่เห็นกราฟ, topup record
  // เห็นแค่ 14 วันล่าสุด (ดู getUserTopupRecords maxDays param)
  // ============================================================

  .get('/users/:uuid/spending-series', async ({ user, params, query, set }) => {
    if (!(await requirePermission(user, 'moderation.spending_series.view', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      const data = await getUserSpendingSeries(params.uuid, query.days ?? 30)
      return { success: true, data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    query: t.Object({ days: t.Optional(t.Numeric({ minimum: 1, maximum: 365 })) }),
    detail: { summary: 'กราฟใช้จ่ายตามระยะเวลา (level >= 9)', tags: ['Admin'] },
  })

  .get('/users/:uuid/login-records', async ({ params, query, set }) => {
    try {
      const data = await getUserLoginRecords(params.uuid, query.page ?? 1, query.limit ?? 20)
      return { success: true, ...data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    query: t.Object({
      page:  t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
    }),
    detail: { summary: 'ประวัติ login (level >= 8)', tags: ['Admin'] },
  })

  .get('/users/:uuid/topup-records', async ({ user, params, query, set }) => {
    try {
      // level 8 เห็นแค่ 14 วันล่าสุด (มติ 2026-07-30 — เผื่อกรณีเงินเข้าช้า ดู KNOWN_ISSUES.md) —
      // ปรับได้ที่ moderation.topup_records.full_history ในหน้าตั้งค่า (แค่จำกัดวัน ไม่ใช่ hard gate
      // จึงเรียก hasPermission() ตรงๆ แทน requirePermission() ที่ set 403 เป็น side effect)
      const maxDays = (await hasPermission(user.level, 'moderation.topup_records.full_history')) ? undefined : 14
      const data = await getUserTopupRecords(params.uuid, query.page ?? 1, query.limit ?? 20, maxDays)
      return { success: true, ...data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    query: t.Object({
      page:  t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
    }),
    detail: { summary: 'ประวัติเติมเงิน (level 8 เห็นแค่ 14 วันล่าสุด)', tags: ['Admin'] },
  })

  .get('/users/:uuid/comment-records', async ({ params, query, set }) => {
    try {
      const data = await getUserCommentRecords(params.uuid, query.page ?? 1, query.limit ?? 20)
      return { success: true, ...data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    query: t.Object({
      page:  t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
    }),
    detail: { summary: 'ประวัติคอมเม้น (level >= 8)', tags: ['Admin'] },
  })

  .get('/users/:uuid/reading-records', async ({ params, query, set }) => {
    try {
      const data = await getUserReadingRecords(
        params.uuid,
        query.page ?? 1,
        query.limit ?? 20,
        query.work_search,
      )
      return { success: true, ...data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ uuid: t.String() }),
    query: t.Object({
      page:        t.Optional(t.Numeric({ minimum: 1 })),
      limit:       t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      work_search: t.Optional(t.String({ maxLength: 100 })),
    }),
    detail: { summary: 'ประวัติการอ่าน+ตอนที่ซื้อ กรองด้วยชื่อเรื่องได้ (level >= 8)', tags: ['Admin'] },
  })

  // ============================================================
  // Ban Requests — level 8 ส่งคำขอ, level >= 9 อนุมัติ/ปฏิเสธ
  // ============================================================

  .post('/ban-requests', async ({ user, body, set }) => {
    try {
      const data = await createAdminActionRequest({
        requestType: 'ban_user',
        requestedBy: BigInt(user.id),
        targetUserUuid: body.target_uuid,
        reason: body.reason,
      })
      set.status = 201
      return { success: true, data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    body: t.Object({
      target_uuid: t.String(),
      reason: t.String({ minLength: 1, maxLength: 500 }),
    }),
    detail: { summary: 'ส่งคำขอแบนผู้ใช้ (level 8)', tags: ['Admin'] },
  })

  .get('/ban-requests', async ({ user, query, set }) => {
    if (!(await requirePermission(user, 'moderation.ban_request.review', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await listAdminActionRequests({
      requestType: 'ban_user',
      status: query.status as 'pending' | 'approved' | 'rejected' | undefined,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    })
    return { success: true, ...data }
  }, {
    query: t.Object({
      status: t.Optional(t.Union([t.Literal('pending'), t.Literal('approved'), t.Literal('rejected')])),
      page:   t.Optional(t.Numeric({ minimum: 1 })),
      limit:  t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
    }),
    detail: { summary: 'รายการคำขอแบนผู้ใช้ (level >= 9)', tags: ['Admin'] },
  })

  .patch('/ban-requests/:id/approve', async ({ user, params, body, set }) => {
    try {
      await approveAdminActionRequest(BigInt(user.id), user.level, BigInt(params.id), body?.note)
      return { success: true, message: 'อนุมัติคำขอแบนแล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Optional(t.Object({ note: t.Optional(t.String({ maxLength: 500 })) })),
    detail: { summary: 'อนุมัติคำขอแบน (level >= 9)', tags: ['Admin'] },
  })

  .patch('/ban-requests/:id/reject', async ({ user, params, body, set }) => {
    try {
      await rejectAdminActionRequest(BigInt(user.id), user.level, BigInt(params.id), body.note)
      return { success: true, message: 'ปฏิเสธคำขอแบนแล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Object({ note: t.String({ minLength: 1, maxLength: 500 }) }),
    detail: { summary: 'ปฏิเสธคำขอแบน (level >= 9)', tags: ['Admin'] },
  })

  // ============================================================
  // Level-8 (Sub-admin) Requests — level 9 ส่งคำขอ, level >= 10 อนุมัติ/ปฏิเสธ
  // ============================================================

  .post('/level8-requests', async ({ user, body, set }) => {
    if (!(await requirePermission(user, 'moderation.level8_request.submit', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      const data = await createAdminActionRequest({
        requestType: 'promote_level_8',
        requestedBy: BigInt(user.id),
        targetUserUuid: body.target_uuid,
        reason: body.reason,
      })
      set.status = 201
      return { success: true, data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    body: t.Object({
      target_uuid: t.String(),
      reason: t.String({ minLength: 1, maxLength: 500 }),
    }),
    detail: { summary: 'ส่งคำขอเพิ่มบัญชี level 8 (level 9)', tags: ['Admin'] },
  })

  .get('/level8-requests', async ({ user, query, set }) => {
    if (!(await requirePermission(user, 'moderation.level8_request.review', set))) {
      return { success: false, message: 'ต้องเป็น shareholder เท่านั้น (level 10) หรือได้รับสิทธินี้จากหน้าตั้งค่า' }
    }
    const data = await listAdminActionRequests({
      requestType: 'promote_level_8',
      status: query.status as 'pending' | 'approved' | 'rejected' | undefined,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    })
    return { success: true, ...data }
  }, {
    query: t.Object({
      status: t.Optional(t.Union([t.Literal('pending'), t.Literal('approved'), t.Literal('rejected')])),
      page:   t.Optional(t.Numeric({ minimum: 1 })),
      limit:  t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
    }),
    detail: { summary: 'รายการคำขอเพิ่ม level 8 (level >= 10)', tags: ['Admin'] },
  })

  .patch('/level8-requests/:id/approve', async ({ user, params, body, set }) => {
    try {
      await approveAdminActionRequest(BigInt(user.id), user.level, BigInt(params.id), body?.note)
      return { success: true, message: 'อนุมัติคำขอเพิ่ม level 8 แล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Optional(t.Object({ note: t.Optional(t.String({ maxLength: 500 })) })),
    detail: { summary: 'อนุมัติคำขอเพิ่ม level 8 (level >= 10)', tags: ['Admin'] },
  })

  .patch('/level8-requests/:id/reject', async ({ user, params, body, set }) => {
    try {
      await rejectAdminActionRequest(BigInt(user.id), user.level, BigInt(params.id), body.note)
      return { success: true, message: 'ปฏิเสธคำขอเพิ่ม level 8 แล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Object({ note: t.String({ minLength: 1, maxLength: 500 }) }),
    detail: { summary: 'ปฏิเสธคำขอเพิ่ม level 8 (level >= 10)', tags: ['Admin'] },
  })

  // ============================================================
  // Writer Applications — "อนุมัติคน" หน้าที่หลักของ level 8 (ทำได้ทันที ไม่ต้องขอสิทธิ์เพิ่ม)
  // ============================================================

  .get('/writer-applications', async ({ user, query, set }) => {
    if (!(await requirePermission(user, 'moderation.writer_application.review', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await listWriterApplications({
      status: query.status as 'pending' | 'approve' | 'rejected' | undefined,
      application_type: query.application_type as 'new_writer' | 'edit' | undefined,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    })
    return { success: true, ...data }
  }, {
    query: t.Object({
      status: t.Optional(t.Union([t.Literal('pending'), t.Literal('approve'), t.Literal('rejected')])),
      application_type: t.Optional(t.Union([t.Literal('new_writer'), t.Literal('edit')])),
      page:   t.Optional(t.Numeric({ minimum: 1 })),
      limit:  t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
    }),
    detail: { summary: 'รายการคำขอเป็นนักเขียน/แก้ไขข้อมูล (level >= 8)', tags: ['Admin'] },
  })

  .patch('/writer-applications/:id/approve', async ({ user, params, set }) => {
    if (!(await requirePermission(user, 'moderation.writer_application.review', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await approveWriterApplication(BigInt(user.id), user.level, BigInt(params.id))
      return { success: true, message: 'อนุมัติคำขอเป็นนักเขียนแล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'อนุมัติคำขอเป็นนักเขียน (level >= 8)', tags: ['Admin'] },
  })

  .patch('/writer-applications/:id/reject', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'moderation.writer_application.review', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await rejectWriterApplication(BigInt(user.id), BigInt(params.id), body.reason)
      return { success: true, message: 'ปฏิเสธคำขอเป็นนักเขียนแล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Object({ reason: t.String({ minLength: 1, maxLength: 500 }) }),
    detail: { summary: 'ปฏิเสธคำขอเป็นนักเขียน (level >= 8)', tags: ['Admin'] },
  })

  // ============================================================
  // Content Report Review — level >= 8 ดู/resolve/dismiss ได้เลย (ดูคอมเมนต์เหนือ
  // listContentReports ใน admin.service.ts — แค่ปิดเคสในคิว ไม่ลบ/แบนอัตโนมัติ)
  // ============================================================

  .get('/reports', async ({ user, query, set }) => {
    if (!(await requirePermission(user, 'moderation.content_report.review', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await listContentReports({
      targetType: query.target_type as 'comment' | 'work' | 'user' | undefined,
      status: query.status as 'pending' | 'resolved' | 'dismissed' | undefined,
      category: query.category as any,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    })
    return { success: true, ...data }
  }, {
    query: t.Object({
      target_type: t.Optional(t.Union([t.Literal('comment'), t.Literal('work'), t.Literal('user')])),
      status: t.Optional(t.Union([t.Literal('pending'), t.Literal('resolved'), t.Literal('dismissed')])),
      category: t.Optional(t.Union([
        t.Literal('content_error'), t.Literal('copyright'), t.Literal('unrated_18plus'),
        t.Literal('inappropriate'), t.Literal('scam'), t.Literal('spam'),
        t.Literal('impersonation'), t.Literal('harassment'), t.Literal('general'), t.Literal('other'),
      ])),
      page:   t.Optional(t.Numeric({ minimum: 1 })),
      limit:  t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
    }),
    detail: { summary: 'รายการรายงานเนื้อหา (level >= 8) — filter category ได้ (migration 032)', tags: ['Admin'] },
  })

  .patch('/reports/:id/resolve', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'moderation.content_report.review', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await resolveContentReport(BigInt(user.id), BigInt(params.id), body?.note)
      return { success: true, message: 'ปิดเคสรายงานแล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Optional(t.Object({ note: t.Optional(t.String({ maxLength: 500 })) })),
    detail: { summary: 'ปิดเคสรายงาน (level >= 8)', tags: ['Admin'] },
  })

  .patch('/reports/:id/dismiss', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'moderation.content_report.review', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await dismissContentReport(BigInt(user.id), BigInt(params.id), body?.note)
      return { success: true, message: 'ยกเลิกรายงานแล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Optional(t.Object({ note: t.Optional(t.String({ maxLength: 500 })) })),
    detail: { summary: 'ยกเลิกรายงาน (ไม่มีมูล) (level >= 8)', tags: ['Admin'] },
  })

  // ============================================================
  // Withdrawal Management — "จัดการธุรกรรม" เงินจริงออกจากระบบ ไม่ใช่หน้าที่ของ level 8
  // ต้อง level >= 9 ทุก endpoint ในหมวดนี้ (2026-08-04 user ยืนยัน — รูปแบบเดียวกับ Carousel/
  // Analytics ด้านล่าง ที่ level 10 ก็เข้าได้เหมือนกันเพราะ level สูงกว่ามีสิทธิ์ระดับต่ำกว่าเสมอ)
  // ============================================================

  // --------------------------------------------------
  // GET /admin/withdrawals
  // รายการคำขอถอนเงิน (กรองด้วย status ได้)
  // --------------------------------------------------
  .get('/withdrawals', async ({ user, query, set }) => {
    if (!(await requirePermission(user, 'economy.withdrawal.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await listWithdrawals({
      page:   query.page  ?? 1,
      limit:  query.limit ?? 20,
      status: query.status as 'pending' | 'approved' | 'rejected' | undefined,
    })
    return { success: true, ...data }
  }, {
    query: t.Object({
      page:   t.Optional(t.Numeric({ minimum: 1 })),
      limit:  t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      status: t.Optional(t.Union([
        t.Literal('pending'),
        t.Literal('approved'),
        t.Literal('rejected'),
      ])),
    }),
    detail: { summary: 'รายการคำขอถอนเงิน (level >= 9)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // PATCH /admin/withdrawals/:id/approve
  // อนุมัติการถอนเงิน → หัก sales ของ writer ออกอัตโนมัติ
  //
  // migration 033: บังคับแนบ "หลักฐานการโอน" (สลิป) มาด้วยเสมอ — เปลี่ยนจาก JSON body ธรรมดา
  // เป็น multipart (field "proof") ⚠️ ไม่ใช้ t.File() เหตุผลเดียวกับจุดอื่นในระบบ (ดู comment ที่
  // POST /admin/carousels) — parse เองผ่าน request.formData() แทน
  //
  // migration 034: บังคับพิมพ์ "ชื่อผู้อนุมัติ/ผู้โอน" มาด้วย (field "transferred_by_name") แยกจาก
  // ตัวตนของบัญชีแอดมินที่ล็อกอินอยู่ (user.id) — บัญชีแอดมินอาจถูกใช้ร่วมกันหลายคน
  // --------------------------------------------------
  .patch('/withdrawals/:id/approve', async ({ user, params, request, set }) => {
    if (!(await requirePermission(user, 'economy.withdrawal.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      const formData = await request.formData()
      const file = formData.get('proof')

      if (!(file instanceof File)) {
        set.status = 400
        return { success: false, message: 'กรุณาแนบหลักฐานการโอน (สลิป)' }
      }
      if (!isAllowedImageType(file.type)) {
        set.status = 400
        return { success: false, message: 'รองรับเฉพาะ JPG, PNG, WebP เท่านั้น' }
      }
      if (file.size > 5 * 1024 * 1024) {
        set.status = 400
        return { success: false, message: 'ไฟล์ต้องไม่เกิน 5MB' }
      }

      const transferredByNameRaw = formData.get('transferred_by_name')
      const transferredByName = typeof transferredByNameRaw === 'string' ? transferredByNameRaw.trim() : ''
      if (!transferredByName) {
        set.status = 400
        return { success: false, message: 'กรุณาระบุชื่อผู้อนุมัติ/ผู้โอน' }
      }

      const note = formData.get('note')
      const buffer = Buffer.from(await file.arrayBuffer())

      await approveWithdrawal(
        BigInt(user.id),
        BigInt(params.id),
        { buffer, contentType: file.type },
        transferredByName,
        typeof note === 'string' && note.trim() !== '' ? note.trim() : undefined,
      )
      return { success: true, message: 'อนุมัติการถอนเงินแล้ว' }
    } catch (err: any) {
      if (err.message === 'TRANSFERRED_BY_NAME_REQUIRED') {
        set.status = 400
        return { success: false, message: 'กรุณาระบุชื่อผู้อนุมัติ/ผู้โอน' }
      }
      return handleAdminError(err, set)
    }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'อนุมัติคำขอถอนเงิน พร้อมแนบหลักฐานการโอน+ชื่อผู้โอน (multipart, fields "proof"/"transferred_by_name") (level >= 9)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // PATCH /admin/withdrawals/:id/reject
  // ปฏิเสธการถอนเงิน (note บังคับ — writer ต้องรู้เหตุผล)
  // --------------------------------------------------
  .patch('/withdrawals/:id/reject', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'economy.withdrawal.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await rejectWithdrawal(BigInt(user.id), BigInt(params.id), body.note)
      return { success: true, message: 'ปฏิเสธการถอนเงินแล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body:   t.Object({
      note: t.String({ minLength: 1, maxLength: 500 }),
    }),
    detail: { summary: 'ปฏิเสธคำขอถอนเงิน (level >= 9)', tags: ['Admin'] },
  })

  // ============================================================
  // Bank Change Request Management (migration 031)
  // ⚠️ ยังไม่มีหน้า UI ฝั่ง apps/admin เรียกใช้ endpoint กลุ่มนี้เลย (รอ design reference —
  // ดู KNOWN_ISSUES.md) แต่ backend พร้อมสมบูรณ์แล้ว เข้าทดสอบผ่าน Swagger/Postman ได้
  // ============================================================

  // --------------------------------------------------
  // GET /admin/bank-change-requests
  // รายการคำขอตั้ง/เปลี่ยนบัญชีธนาคาร (กรองด้วย status ได้)
  // --------------------------------------------------
  .get('/bank-change-requests', async ({ user, query, set }) => {
    if (!(await requirePermission(user, 'economy.bank_change.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await listBankChangeRequests({
      page:   query.page  ?? 1,
      limit:  query.limit ?? 20,
      status: query.status as 'pending' | 'approved' | 'rejected' | undefined,
    })
    return { success: true, ...data }
  }, {
    query: t.Object({
      page:   t.Optional(t.Numeric({ minimum: 1 })),
      limit:  t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      status: t.Optional(t.Union([
        t.Literal('pending'),
        t.Literal('approved'),
        t.Literal('rejected'),
      ])),
    }),
    detail: { summary: 'รายการคำขอเปลี่ยนบัญชีธนาคาร (level >= 9)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // PATCH /admin/bank-change-requests/:id/approve
  // อนุมัติคำขอ → ตั้งเป็นบัญชีธนาคารจริงของ user ทันที
  // --------------------------------------------------
  .patch('/bank-change-requests/:id/approve', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'economy.bank_change.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await approveBankChangeRequest(BigInt(user.id), BigInt(params.id), body?.note)
      return { success: true, message: 'อนุมัติคำขอเปลี่ยนบัญชีธนาคารแล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body:   t.Optional(t.Object({
      note: t.Optional(t.String({ maxLength: 500 })),
    })),
    detail: { summary: 'อนุมัติคำขอเปลี่ยนบัญชีธนาคาร (level >= 9)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // PATCH /admin/bank-change-requests/:id/reject
  // ปฏิเสธคำขอ (note บังคับ — writer ต้องรู้เหตุผล)
  // --------------------------------------------------
  .patch('/bank-change-requests/:id/reject', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'economy.bank_change.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await rejectBankChangeRequest(BigInt(user.id), BigInt(params.id), body.note)
      return { success: true, message: 'ปฏิเสธคำขอเปลี่ยนบัญชีธนาคารแล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body:   t.Object({
      note: t.String({ minLength: 1, maxLength: 500 }),
    }),
    detail: { summary: 'ปฏิเสธคำขอเปลี่ยนบัญชีธนาคาร (level >= 9)', tags: ['Admin'] },
  })

  // ============================================================
  // Carousel Management — "งานใหญ่ๆ" ของเว็บ ไม่ใช่หน้าที่ของ level 8 (แอดมินย่อย)
  // ต้อง level >= 9 ทุก endpoint ในหมวดนี้ (มติ 2026-07-30)
  //
  // 2026-08-04 ต่อจริง: POST/PATCH เปลี่ยนเป็น multipart/form-data (รับรูปจริงในคำขอเดียวกับ
  // ข้อมูล ไม่ใช่ 2 ขั้นตอนแบบ cover ผลงาน เพราะ carousel ต้องมีรูปตั้งแต่สร้างเสมอ) — ไม่ใช้
  // t.File()/t.Object() กับ multipart เพราะ Elysia มีบั๊กรู้จักแล้ว (เหตุผลเดียวกับ cover ผลงาน
  // ดู admin-works.routes.ts) parse เองผ่าน request.formData() แทน (helper parseCarouselFields
  // อยู่นอก chain ด้านบนไฟล์ — ใส่ในนี้ไม่ได้เพราะ .get().post()... เป็น expression เดียวยาวๆ)
  // ============================================================

  // --------------------------------------------------
  // GET /admin/carousels
  // รายการ carousel ทั้งหมด (เรียงตาม sort_order)
  // --------------------------------------------------
  .get('/carousels', async ({ user, set }) => {
    if (!(await requirePermission(user, 'content.carousel.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await listCarousels()
    return { success: true, data }
  }, {
    detail: { summary: 'รายการ carousel (level >= 9)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // POST /admin/carousels — multipart: field "image" (required) + ข้อมูลอื่นๆ
  // --------------------------------------------------
  .post('/carousels', async ({ user, request, set }) => {
    if (!(await requirePermission(user, 'content.carousel.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      const formData = await request.formData()
      const file = formData.get('image')
      if (!(file instanceof File)) {
        set.status = 400
        return { success: false, message: 'ไม่พบไฟล์รูป' }
      }
      if (file.size > CAROUSEL_MAX_FILE_SIZE) {
        set.status = 400
        return { success: false, message: `ไฟล์ต้องไม่เกิน ${CAROUSEL_MAX_FILE_SIZE_MB}MB` }
      }
      const fields = parseCarouselFields(formData)
      if (!fields.title) {
        set.status = 400
        return { success: false, message: 'กรุณาใส่ชื่อปก' }
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      const data = await createCarousel(BigInt(user.id), { ...fields, title: fields.title }, { buffer, contentType: file.type })
      set.status = 201
      return { success: true, data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    detail: { summary: 'สร้าง carousel (multipart, field "image")', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // PATCH /admin/carousels/:id — multipart: field "image" (optional — ไม่ส่ง = ไม่เปลี่ยนรูป)
  // --------------------------------------------------
  .patch('/carousels/:id', async ({ user, params, request, set }) => {
    if (!(await requirePermission(user, 'content.carousel.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      const formData = await request.formData()
      const file = formData.get('image')
      let image: { buffer: Buffer; contentType: string } | undefined
      if (file instanceof File) {
        if (file.size > CAROUSEL_MAX_FILE_SIZE) {
          set.status = 400
          return { success: false, message: `ไฟล์ต้องไม่เกิน ${CAROUSEL_MAX_FILE_SIZE_MB}MB` }
        }
        image = { buffer: Buffer.from(await file.arrayBuffer()), contentType: file.type }
      }
      const fields = parseCarouselFields(formData)
      const data = await updateCarousel(BigInt(user.id), BigInt(params.id), fields, image)
      return { success: true, data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'แก้ carousel (multipart, field "image" ไม่บังคับ)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // PATCH /admin/carousels/reorder — ลาก-วางจัดลำดับใหม่
  // --------------------------------------------------
  .patch('/carousels/reorder', async ({ user, body, set }) => {
    if (!(await requirePermission(user, 'content.carousel.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await reorderCarousels(BigInt(user.id), body.ids.map((id) => BigInt(id)))
      return { success: true, message: 'จัดลำดับใหม่สำเร็จ' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    body: t.Object({ ids: t.Array(t.String({ pattern: '^[0-9]+$' }), { minItems: 1 }) }),
    detail: { summary: 'จัดลำดับ carousel ใหม่ทั้งชุด', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // DELETE /admin/carousels/:id
  // --------------------------------------------------
  .delete('/carousels/:id', async ({ user, params, set }) => {
    if (!(await requirePermission(user, 'content.carousel.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await deleteCarousel(BigInt(user.id), BigInt(params.id))
      return { success: true, message: 'ลบ carousel แล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'ลบ carousel', tags: ['Admin'] },
  })

  // ============================================================
  // Featured Works — "นิยายแนะนำแบบ Cheesy" (migration 028) — level >= 9 เท่านั้น
  // ============================================================

  .get('/featured-works', async ({ user, set }) => {
    if (!(await requirePermission(user, 'content.featured_works.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await listFeaturedWorks()
    return { success: true, data }
  }, {
    detail: { summary: 'รายการนิยายที่บูสต์อยู่ตอนนี้ (level >= 9)', tags: ['Admin'] },
  })

  .get('/featured-works/preview', async ({ user, query, set }) => {
    if (!(await requirePermission(user, 'content.featured_works.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await getFeaturedPreview(query.limit ?? 12)
    return { success: true, data, recommended_max: FEATURED_RECOMMENDED_MAX }
  }, {
    query: t.Object({ limit: t.Optional(t.Numeric({ minimum: 1, maximum: 30 })) }),
    detail: { summary: '"จำลองหน้า Home" 3 คอลัมน์ (organic + boosted จริงทั้งคู่)', tags: ['Admin'] },
  })

  .post('/featured-works', async ({ user, body, set }) => {
    if (!(await requirePermission(user, 'content.featured_works.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      const data = await addFeaturedWork(BigInt(user.id), {
        workUuid: body.work_uuid,
        section: body.section,
        durationDays: body.duration_days,
      })
      set.status = 201
      return { success: true, data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    body: t.Object({
      work_uuid:     t.String(),
      section:       t.Union([t.Literal('sales'), t.Literal('popular'), t.Literal('latest')]),
      duration_days: t.Optional(t.Numeric({ minimum: 1, maximum: 90 })),
    }),
    detail: { summary: 'เพิ่มนิยายเข้าคิวบูสต์ (level >= 9)', tags: ['Admin'] },
  })

  .patch('/featured-works/reorder', async ({ user, body, set }) => {
    if (!(await requirePermission(user, 'content.featured_works.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await reorderFeaturedWorks(BigInt(user.id), body.section, body.ids.map((id) => BigInt(id)))
      return { success: true, message: 'จัดลำดับใหม่สำเร็จ' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    body: t.Object({
      section: t.Union([t.Literal('sales'), t.Literal('popular'), t.Literal('latest')]),
      ids:     t.Array(t.String({ pattern: '^[0-9]+$' }), { minItems: 1 }),
    }),
    detail: { summary: 'จัดลำดับนิยายที่บูสต์ในคอลัมน์เดียวกันใหม่', tags: ['Admin'] },
  })

  .delete('/featured-works/:id', async ({ user, params, set }) => {
    if (!(await requirePermission(user, 'content.featured_works.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await removeFeaturedWork(BigInt(user.id), BigInt(params.id))
      return { success: true, message: 'เอาออกจากคิวบูสต์แล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'เอานิยายออกจากคิวบูสต์', tags: ['Admin'] },
  })

  // ============================================================
  // Writer Message Center — ข่าวสาร / ข้อความถึงนักเขียน / ประวัติ
  // ทุก mutation ตั้งใจให้ Admin รองขึ้นไปเป็นผู้สั่ง (level >= 9)
  // ============================================================

  .get('/writer-message-recipients', async ({ user, query, set }) => {
    if (!(await requirePermission(user, 'content.writer_message.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await listWriterMessageRecipients(query.search)
    return { success: true, data }
  }, {
    query: t.Object({ search: t.Optional(t.String({ maxLength: 100 })) }),
    detail: { summary: 'ค้นหารายชื่อนักเขียนสำหรับส่งข้อความ', tags: ['Admin'] },
  })

  .post('/writer-messages', async ({ user, body, set }) => {
    if (!(await requirePermission(user, 'content.writer_message.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      const data = await createDirectWriterMessage(BigInt(user.id), {
        writerUuid: body.writer_uuid,
        subject: body.subject,
        message: body.message,
        severity: body.severity,
      })
      set.status = 201
      return { success: true, data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    body: t.Object({
      writer_uuid: t.String({ minLength: 1 }),
      subject: t.String({ minLength: 1, maxLength: 200 }),
      message: t.String({ minLength: 1, maxLength: 5000 }),
      severity: t.Union([t.Literal('normal'), t.Literal('risk'), t.Literal('critical')]),
    }),
    detail: { summary: 'ส่งข้อความถึงนักเขียนโดยตรง', tags: ['Admin'] },
  })

  .get('/writer-message-history', async ({ user, query, set }) => {
    if (!(await requirePermission(user, 'content.writer_message.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await listWriterMessageHistory(
      query.page ?? 1,
      query.limit ?? 50,
      query.source as 'work_notice' | 'admin_message' | 'system_action' | undefined,
    )
    return { success: true, ...data }
  }, {
    query: t.Object({
      page: t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      source: t.Optional(t.Union([
        t.Literal('work_notice'),
        t.Literal('admin_message'),
        t.Literal('system_action'),
      ])),
    }),
    detail: { summary: 'ประวัติข้อความและเหตุการณ์ที่ส่งถึงนักเขียน', tags: ['Admin'] },
  })

  // ============================================================
  // Announcement Management — ข่าวสารถึงทุกคน (level >= 9)
  // ============================================================

  // --------------------------------------------------
  // GET /admin/announcements
  // รายการประกาศ
  //   ?all=true → รวม inactive ด้วย (สำหรับ admin panel)
  //   ไม่ส่ง   → เฉพาะ active (สำหรับ frontend)
  // --------------------------------------------------
  .get('/announcements', async ({ user, query, set }) => {
    if (!(await requirePermission(user, 'content.announcement.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await listAnnouncements(query.all === 'true')
    return { success: true, data }
  }, {
    query: t.Object({
      all: t.Optional(t.String()),
    }),
    detail: { summary: 'รายการประกาศ', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // POST /admin/announcements
  // สร้างประกาศใหม่
  // --------------------------------------------------
  .post('/announcements', async ({ user, body, set }) => {
    if (!(await requirePermission(user, 'content.announcement.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      const data = await createAnnouncement(BigInt(user.id), {
        ...body,
        status: body.status as 'active' | 'inactive' | undefined,
        color:  body.color as 'green' | 'red' | 'purple' | 'gold' | undefined,
      })
      set.status = 201
      return { success: true, data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    body: t.Object({
      title:     t.String({ minLength: 1, maxLength: 200 }),
      content:   t.String({ minLength: 1 }),
      status:    t.Optional(t.String()),   // 'active' | 'inactive'
      color:     t.Optional(t.Union([t.Literal('green'), t.Literal('red'), t.Literal('purple'), t.Literal('gold')])),
    }),
    detail: { summary: 'สร้างประกาศ', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // PATCH /admin/announcements/:id
  // แก้ประกาศ (partial update)
  // --------------------------------------------------
  .patch('/announcements/:id', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'content.announcement.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      const data = await updateAnnouncement(BigInt(user.id), BigInt(params.id), {
        title:   body.title,
        content: body.content,
        status:  body.status as 'active' | 'inactive' | undefined,
        color:   body.color as 'green' | 'red' | 'purple' | 'gold' | undefined,
      })
      return { success: true, data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Object({
      title:   t.Optional(t.String({ minLength: 1, maxLength: 200 })),
      content: t.Optional(t.String({ minLength: 1 })),
      status:  t.Optional(t.Union([t.Literal('active'), t.Literal('inactive')])),
      color:   t.Optional(t.Union([t.Literal('green'), t.Literal('red'), t.Literal('purple'), t.Literal('gold')])),
    }),
    detail: { summary: 'แก้ประกาศ', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // DELETE /admin/announcements/:id
  // ลบประกาศ (soft delete)
  // --------------------------------------------------
  .delete('/announcements/:id', async ({ user, params, set }) => {
    if (!(await requirePermission(user, 'content.announcement.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await deleteAnnouncement(BigInt(user.id), BigInt(params.id))
      return { success: true, message: 'ลบประกาศแล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'ลบประกาศ', tags: ['Admin'] },
  })

  // ============================================================
  // Category Management (migration 049) — เดิมต้องแก้ผ่าน SQL migration ตรงๆ เท่านั้น
  // gate ด้วย content.categories.manage (ปรับได้ที่หน้าตั้งค่า)
  // ============================================================

  .get('/categories', async ({ user, set }) => {
    if (!(await requirePermission(user, 'content.categories.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await getCategoriesAdmin()
    return { success: true, data }
  }, {
    detail: { summary: 'รายการหมวดหมู่ทั้งหมด รวมที่ปิดไว้ (level >= 9)', tags: ['Admin'] },
  })

  .post('/categories', async ({ user, body, set }) => {
    if (!(await requirePermission(user, 'content.categories.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      const data = await createCategory(body.name, body.icon ?? null)
      set.status = 201
      return { success: true, data }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    body: t.Object({
      name: t.String({ minLength: 1, maxLength: 50 }),
      icon: t.Optional(t.Nullable(t.String({ maxLength: 10 }))),
    }),
    detail: { summary: 'เพิ่มหมวดหมู่ใหม่', tags: ['Admin'] },
  })

  .patch('/categories/:id', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'content.categories.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await updateCategory(BigInt(params.id), body)
      return { success: true, message: 'บันทึกแล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Object({
      name:   t.Optional(t.String({ minLength: 1, maxLength: 50 })),
      icon:   t.Optional(t.Nullable(t.String({ maxLength: 10 }))),
      status: t.Optional(t.Boolean()),
    }),
    detail: { summary: 'แก้ชื่อ/ไอคอน/เปิดปิดการมองเห็นหมวดหมู่', tags: ['Admin'] },
  })

  .delete('/categories/:id', async ({ user, params, set }) => {
    if (!(await requirePermission(user, 'content.categories.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await deleteCategory(BigInt(params.id))
      return { success: true, message: 'ลบหมวดหมู่แล้ว' }
    } catch (err: any) { return handleAdminError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'ลบหมวดหมู่ (บล็อกถ้ามีนิยายใช้อยู่)', tags: ['Admin'] },
  })

  // ============================================================
  // Web Settings — "งานใหญ่ๆ" เหมือนกัน ต้อง level >= 9
  // ============================================================

  // --------------------------------------------------
  // GET /admin/settings
  // ดู settings ทั้งหมด — คืนเป็น { key: value } object
  // --------------------------------------------------
  .get('/settings', async ({ user, set }) => {
    if (!(await requirePermission(user, 'system.web_settings.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await getWebSettings()
    return { success: true, data }
  }, {
    detail: { summary: 'ดู web settings (level >= 9)', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // PATCH /admin/settings
  // อัปเดต settings
  // ส่ง body เป็น { "site_name": "...", "maintenance": "false" }
  // ทำ upsert — ถ้า key ยังไม่มีก็สร้างใหม่
  // --------------------------------------------------
  .patch('/settings', async ({ user, body, set }) => {
    if (!(await requirePermission(user, 'system.web_settings.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    await updateWebSettings(BigInt(user.id), body as Record<string, string>)
    return { success: true, message: 'อัปเดต settings แล้ว' }
  }, {
    body: t.Record(t.String(), t.String()),
    detail: { summary: 'อัปเดต web settings', tags: ['Admin'] },
  })

  // ============================================================
  // Audit Logs — "งานใหญ่ๆ" เหมือนกัน ต้อง level >= 9
  // ============================================================

  // --------------------------------------------------
  // GET /admin/audit-logs
  // ดูประวัติ action ของ admin ทั้งหมด
  // กรอง action ได้ เช่น ?action=BAN_USER
  // --------------------------------------------------
  .get('/audit-logs', async ({ user, query, set }) => {
    if (!(await requirePermission(user, 'system.audit_log.view', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await getAuditLogs({
      page:   query.page   ?? 1,
      limit:  query.limit  ?? 50,
      event_type: query.event_type,
      event_types: query.event_types ? query.event_types.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
      search: query.search,
    })
    return { success: true, ...data }
  }, {
    query: t.Object({
      page:         t.Optional(t.Numeric({ minimum: 1 })),
      limit:        t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      event_type:   t.Optional(t.String()),
      event_types:  t.Optional(t.String({ maxLength: 300 })), // comma-separated
      search:       t.Optional(t.String({ maxLength: 100 })),
    }),
    detail: { summary: 'ดู audit logs', tags: ['Admin'] },
  })

  // --------------------------------------------------
  // GET /admin/audit-logs/event-types
  // ประเภท event ทั้งหมดที่เคยเกิดจริง — ใช้สร้าง dropdown กรอง
  // --------------------------------------------------
  .get('/audit-logs/event-types', async ({ user, set }) => {
    if (!(await requirePermission(user, 'system.audit_log.view', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await getAuditLogEventTypes()
    return { success: true, data }
  }, {
    detail: { summary: 'ประเภท event ของ audit log ทั้งหมด', tags: ['Admin'] },
  })
