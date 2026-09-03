// =============================================================
// Novel Platform — Redeem Code Routes (2026-08-18, ใหม่)
// วางไว้ที่: apps/api/src/modules/redeem/redeem.routes.ts
// =============================================================

import Elysia, { t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { accountRateLimitRule, enforceRateLimit } from '../../lib/rate-limit'
import { redeemCode, getActiveBonus, getMyRedeemHistory } from './redeem.service'

const ERROR_MAP: Record<string, { status: number; message: string }> = {
  CODE_REQUIRED:          { status: 400, message: 'กรุณากรอกโค้ด' },
  CODE_NOT_FOUND:         { status: 404, message: 'ไม่พบโค้ดนี้ กรุณาตรวจสอบอีกครั้ง' },
  CODE_DISABLED:          { status: 400, message: 'โค้ดนี้ถูกปิดใช้งานแล้ว' },
  CODE_NOT_YET_VALID:     { status: 400, message: 'โค้ดนี้ยังไม่ถึงเวลาใช้งาน' },
  CODE_EXPIRED:           { status: 400, message: 'โค้ดนี้หมดอายุแล้ว' },
  CODE_MAX_USES_REACHED:  { status: 400, message: 'โค้ดนี้ถูกใช้ครบจำนวนแล้ว' },
  ALREADY_REDEEMED:       { status: 400, message: 'คุณใช้โค้ดนี้ไปแล้ว' },
  BONUS_ALREADY_ACTIVE:   { status: 400, message: 'คุณมีโบนัสที่ยังไม่ได้ใช้อยู่แล้ว รอให้หมดเวลาหรือเติมเงินให้เสร็จก่อนถึงจะแลกโค้ดโบนัสใหม่ได้' },
  CANNOT_REDEEM_OWN_CODE: { status: 400, message: 'ใช้โค้ดชวนเพื่อนของตัวเองไม่ได้' },
  ALREADY_REFERRED:       { status: 400, message: 'คุณเคยถูกเชิญด้วยโค้ดชวนเพื่อนไปแล้ว ใช้ได้แค่ครั้งเดียวต่อบัญชี' },
}

export const redeemRoutes = new Elysia({ prefix: '/redeem-codes' })
  .use(authMiddleware)

  .post('/redeem', async ({ user, body, set }) => {
    // ป้องกันไล่เดาโค้ด (แม้ charset สุ่ม 8 ตัวจะมี keyspace ใหญ่มากก็ตาม) และกันสแปมยิงรัว
    const limited = await enforceRateLimit(set, [
      accountRateLimitRule('redeem-code', user.id, 20, 15 * 60),
    ])
    if (limited) return limited

    try {
      const result = await redeemCode(BigInt(user.id), body.code)
      return { success: true, data: result }
    } catch (err: any) {
      const matched = ERROR_MAP[err.message]
      if (matched) {
        set.status = matched.status
        return { success: false, message: matched.message }
      }
      throw err
    }
  }, {
    body: t.Object({ code: t.String({ minLength: 1, maxLength: 40 }) }),
    detail: { summary: 'แลกโค้ด (เติมเหรียญทันที, เปิดสิทธิ์โบนัส % เติมเงินครั้งถัดไป, หรือรับโค้ดชวนเพื่อน)', tags: ['Redeem'] },
  })

  .get('/active-bonus', async ({ user }) => {
    const data = await getActiveBonus(BigInt(user.id))
    return { success: true, data }
  }, {
    detail: { summary: 'โบนัส % เติมเงินที่กำลังรอใช้อยู่ (null = ไม่มี)', tags: ['Redeem'] },
  })

  .get('/history', async ({ user, query }) => {
    const data = await getMyRedeemHistory(BigInt(user.id), query.page ?? 1, query.limit ?? 20)
    return { success: true, ...data }
  }, {
    query: t.Object({
      page:  t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
    }),
    detail: { summary: 'ประวัติการใช้โค้ดของตัวเอง', tags: ['Redeem'] },
  })
