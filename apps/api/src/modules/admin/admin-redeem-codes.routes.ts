// =============================================================
// Novel Platform — Admin Redeem Codes Routes (2026-08-18, ใหม่)
// วางไว้ที่: apps/api/src/modules/admin/admin-redeem-codes.routes.ts
// =============================================================
//
// หน้า "จัดการธุรกรรม > โค้ดส่วนลด/เติมเหรียญ" — gate ด้วย economy.redeem_codes.manage
// (ปรับได้ที่หน้าตั้งค่า) เหมือน admin-tags.routes.ts

import Elysia, { t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { requirePermission, PERMISSION_DENIED_MESSAGE } from '../../lib/permission-guard'
import { getRedeemCodesAdmin, createRedeemCode, updateRedeemCode, getRedeemCodeUses } from './admin-redeem-codes.service'

function handleError(err: any, set: any) {
  const map: Record<string, { status: number; message: string }> = {
    CODE_REQUIRED:          { status: 400, message: 'กรุณากรอกโค้ด' },
    CODE_TAKEN:             { status: 409, message: 'มีโค้ดนี้อยู่แล้ว' },
    INVALID_VALUE:          { status: 400, message: 'มูลค่าโค้ดต้องมากกว่า 0' },
    INVALID_PERCENT:        { status: 400, message: '% โบนัสต้องไม่เกิน 100' },
    REDEEM_CODE_NOT_FOUND:  { status: 404, message: 'ไม่พบโค้ดนี้ (อาจถูกลบไปแล้ว)' },
  }
  const matched = map[err.message]
  if (matched) {
    set.status = matched.status
    return { success: false, message: matched.message }
  }
  throw err
}

const codeInputBody = {
  value:              t.Number({ minimum: 0.01 }),
  bonus_window_hours: t.Optional(t.Nullable(t.Numeric({ minimum: 1 }))),
  max_uses:           t.Optional(t.Nullable(t.Numeric({ minimum: 1 }))),
  max_uses_per_user:  t.Optional(t.Numeric({ minimum: 1 })),
  valid_from:         t.Optional(t.Nullable(t.String())),
  valid_until:        t.Optional(t.Nullable(t.String())),
  label:              t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
}

export const adminRedeemCodesRoutes = new Elysia({ prefix: '/admin/redeem-codes' })
  .use(authMiddleware)

  .get('/', async ({ user, query, set }) => {
    if (!(await requirePermission(user, 'economy.redeem_codes.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await getRedeemCodesAdmin(query.page ?? 1, query.limit ?? 50)
    return { success: true, ...data }
  }, {
    query: t.Object({
      page:  t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
    }),
    detail: { summary: 'รายการโค้ดทั้งหมด', tags: ['Admin'] },
  })

  .post('/', async ({ user, body, set }) => {
    if (!(await requirePermission(user, 'economy.redeem_codes.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      const result = await createRedeemCode(BigInt(user.id), body)
      set.status = 201
      return { success: true, ...result }
    } catch (err: any) { return handleError(err, set) }
  }, {
    body: t.Object({
      code: t.String({ minLength: 1, maxLength: 40 }),
      type: t.Union([t.Literal('instant_coins'), t.Literal('topup_bonus_percent')]),
      ...codeInputBody,
    }),
    detail: { summary: 'สร้างโค้ดใหม่', tags: ['Admin'] },
  })

  .patch('/:id', async ({ user, params, body, set }) => {
    if (!(await requirePermission(user, 'economy.redeem_codes.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      const result = await updateRedeemCode(BigInt(params.id), body)
      return { success: true, ...result }
    } catch (err: any) { return handleError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    body: t.Object({
      ...codeInputBody,
      value:  t.Optional(t.Number({ minimum: 0.01 })),
      status: t.Optional(t.Union([t.Literal('active'), t.Literal('disabled')])),
    }),
    detail: { summary: 'แก้ไขโค้ด (code/type แก้ไม่ได้ — ต้องสร้างใหม่แทน)', tags: ['Admin'] },
  })

  .get('/:id/uses', async ({ user, params, query, set }) => {
    if (!(await requirePermission(user, 'economy.redeem_codes.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      const data = await getRedeemCodeUses(BigInt(params.id), query.page ?? 1, query.limit ?? 50)
      return { success: true, ...data }
    } catch (err: any) { return handleError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    query: t.Object({
      page:  t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
    }),
    detail: { summary: 'ประวัติการแลกของโค้ดหนึ่งใบ', tags: ['Admin'] },
  })
