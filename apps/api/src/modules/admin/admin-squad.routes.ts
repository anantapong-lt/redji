// =============================================================
// Novel Platform — Admin Squad Routes (2026-08-12, ใหม่)
// วางไว้ที่: apps/api/src/modules/admin/admin-squad.routes.ts
// =============================================================
//
// "หน่วยรบ" — ทั้งไฟล์นี้ level >= 9 เท่านั้น (level 8 เข้าไม่ได้เลย ต่างจาก endpoint อื่นในระบบ
// ส่วนใหญ่ที่ level 8 เข้าได้) — สร้าง/ระงับ/ลบ/รีเซ็ตรหัสผ่านบัญชีแอดมิน delegate ไปที่ฟังก์ชันเดิม
// (suspendActivity/liftActivitySuspension/permaDeleteUser) ของ admin.service.ts ตรงๆ

import Elysia, { t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { requirePermission } from '../../lib/permission-guard'
import { suspendActivity, liftActivitySuspension, permaDeleteUser } from './admin.service'
import {
  createSquadAccount,
  resetSquadPassword,
  updateSquadQuota,
  listSquadAdmins,
  getSquadHistory,
} from './admin-squad.service'

function handleSquadError(err: any, set: any) {
  const map: Record<string, { status: number; message: string }> = {
    USER_NOT_FOUND:                { status: 404, message: 'ไม่พบบัญชีนี้' },
    CANNOT_EDIT_SELF:               { status: 400, message: 'ทำรายการนี้กับบัญชีตัวเองไม่ได้' },
    CANNOT_MODERATE_HIGHER_LEVEL:   { status: 403, message: 'ทำรายการนี้กับบัญชีที่ level เท่ากับหรือสูงกว่าตัวเองไม่ได้' },
    ALREADY_ACTIVITY_SUSPENDED:     { status: 400, message: 'บัญชีนี้ถูกระงับอยู่แล้ว' },
    NOT_ACTIVITY_SUSPENDED:         { status: 400, message: 'บัญชีนี้ไม่ได้ถูกระงับอยู่' },
    ALREADY_DELETED:                { status: 400, message: 'บัญชีนี้ถูกลบไปแล้ว' },
    SQUAD_INVALID_TARGET_LEVEL:     { status: 400, message: 'level 9 สร้างได้แค่ level 1/8 และ level 10 สร้างได้แค่ level 1/8/9 เท่านั้น' },
    SQUAD_QUOTA_EXCEEDED:           { status: 429, message: 'สร้างบัญชี level 8 ครบโควตาของเดือนนี้แล้ว' },
    SQUAD_NOT_A_SQUAD_ACCOUNT:      { status: 400, message: 'บัญชีนี้ไม่ใช่บัญชีที่จัดการผ่านหน่วยรบได้' },
    SQUAD_QUOTA_LEVEL10_ONLY:       { status: 403, message: 'ตั้งโควตาได้เฉพาะ level 10 เท่านั้น' },
    SQUAD_QUOTA_ONLY_FOR_LEVEL9:    { status: 400, message: 'ตั้งโควตาได้เฉพาะบัญชี level 9 เท่านั้น' },
  }
  const matched = map[err.message]
  if (matched) {
    set.status = matched.status
    return { success: false, message: matched.message }
  }
  throw err
}

export const adminSquadRoutes = new Elysia({ prefix: '/admin/squad' })
  .use(authMiddleware)
  .onBeforeHandle(async ({ user, set }) => {
    if (!(await requirePermission(user, 'squad.manage', set))) {
      return { success: false, message: 'เข้าหน้านี้ได้เฉพาะแอดมินรองขึ้นไป (level >= 9) หรือได้รับสิทธิ์จากหน้าตั้งค่า' }
    }
  })

  // --------------------------------------------------
  // GET /admin/squad/admins — ลิสต์บัญชีแอดมิน level 8-10
  // --------------------------------------------------
  .get('/admins', async ({ user, query }) => {
    const data = await listSquadAdmins(BigInt(user.id), {
      onlyMine: query.only_mine,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    })
    return { success: true, ...data }
  }, {
    query: t.Object({
      only_mine: t.Optional(t.Boolean()),
      page:      t.Optional(t.Numeric({ minimum: 1 })),
      limit:     t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
    }),
    detail: { summary: 'ลิสต์บัญชีแอดมิน level 8-10', tags: ['Admin Squad'] },
  })

  // --------------------------------------------------
  // POST /admin/squad/admins — สร้างบัญชีใหม่ (level 1 โดย level 9/10, level 8 โดย level 9/10,
  // level 9 โดย level 10 เท่านั้น) — display_name ตั้งเองได้ ที่เหลือสุ่มเสมอ
  // --------------------------------------------------
  .post('/admins', async ({ user, body, set }) => {
    try {
      const result = await createSquadAccount(BigInt(user.id), user.level, body.target_level, body.display_name)
      set.status = 201
      return { success: true, data: result }
    } catch (err: any) {
      return handleSquadError(err, set)
    }
  }, {
    body: t.Object({
      target_level: t.Union([t.Literal(1), t.Literal(8), t.Literal(9)]),
      display_name: t.Optional(t.String({ maxLength: 50 })),
    }),
    detail: { summary: 'สร้างบัญชีใหม่ (สุ่ม username/รหัสผ่าน โชว์ครั้งเดียว)', tags: ['Admin Squad'] },
  })

  // --------------------------------------------------
  // POST /admin/squad/admins/:uuid/reset-password — สุ่มรหัสผ่านใหม่ (โชว์ครั้งเดียว)
  // --------------------------------------------------
  .post('/admins/:uuid/reset-password', async ({ user, params, set }) => {
    try {
      const result = await resetSquadPassword(BigInt(user.id), user.level, params.uuid)
      return { success: true, data: result }
    } catch (err: any) {
      return handleSquadError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'รีเซ็ตรหัสผ่านบัญชีแอดมิน (สุ่มใหม่ โชว์ครั้งเดียว)', tags: ['Admin Squad'] },
  })

  // --------------------------------------------------
  // POST /admin/squad/admins/:uuid/suspend — ระงับบัญชี (delegate ไปที่ suspendActivity เดิม)
  // --------------------------------------------------
  .post('/admins/:uuid/suspend', async ({ user, params, body, set }) => {
    try {
      await suspendActivity(BigInt(user.id), user.level, params.uuid, body.reason)
      return { success: true }
    } catch (err: any) {
      return handleSquadError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({ reason: t.String({ minLength: 1, maxLength: 500 }) }),
    detail: { summary: 'ระงับบัญชีแอดมิน', tags: ['Admin Squad'] },
  })

  // --------------------------------------------------
  // POST /admin/squad/admins/:uuid/lift-suspension — ยกเลิกการระงับ
  // --------------------------------------------------
  .post('/admins/:uuid/lift-suspension', async ({ user, params, set }) => {
    try {
      await liftActivitySuspension(BigInt(user.id), params.uuid)
      return { success: true }
    } catch (err: any) {
      return handleSquadError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    detail: { summary: 'ยกเลิกการระงับบัญชีแอดมิน', tags: ['Admin Squad'] },
  })

  // --------------------------------------------------
  // POST /admin/squad/admins/:uuid/delete — ลบบัญชีถาวร (delegate ไปที่ permaDeleteUser เดิม —
  // anonymize เหมือน user ทั่วไปทุกประการ)
  // --------------------------------------------------
  .post('/admins/:uuid/delete', async ({ user, params, body, set }) => {
    try {
      await permaDeleteUser(BigInt(user.id), user.level, params.uuid, body.reason)
      return { success: true }
    } catch (err: any) {
      return handleSquadError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({ reason: t.String({ minLength: 1, maxLength: 500 }) }),
    detail: { summary: 'ลบบัญชีแอดมินถาวร (anonymize)', tags: ['Admin Squad'] },
  })

  // --------------------------------------------------
  // PATCH /admin/squad/admins/:uuid/quota — ตั้งโควตาสร้าง level 8/เดือน (level 10 เท่านั้น)
  // --------------------------------------------------
  .patch('/admins/:uuid/quota', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'squad.quota.set', set))) {
      return { success: false, message: 'ตั้งโควตาได้เฉพาะ level 10 เท่านั้น (หรือที่ level 10 เปิดสิทธิ์ไว้ในหน้าตั้งค่า)' }
    }
    try {
      await updateSquadQuota(user.level, params.uuid, body.quota)
      return { success: true }
    } catch (err: any) {
      return handleSquadError(err, set)
    }
  }, {
    params: t.Object({ uuid: t.String() }),
    body: t.Object({ quota: t.Numeric({ minimum: 0, maximum: 1000 }) }),
    detail: { summary: 'ตั้งโควตาสร้างบัญชี level 8 ต่อเดือน (level 10 เท่านั้น)', tags: ['Admin Squad'] },
  })

  // --------------------------------------------------
  // GET /admin/squad/history — ประวัติ action ที่เกี่ยวกับบัญชีแอดมิน
  // --------------------------------------------------
  .get('/history', async ({ query }) => {
    const data = await getSquadHistory(query.page ?? 1, query.limit ?? 50)
    return { success: true, ...data }
  }, {
    query: t.Object({
      page:  t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
    }),
    detail: { summary: 'ประวัติ action ของบัญชีแอดมิน', tags: ['Admin Squad'] },
  })
