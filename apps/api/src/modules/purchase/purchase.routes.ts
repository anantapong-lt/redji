// =============================================================
// Novel Platform — Purchase Routes
// วางไว้ที่: apps/api/src/modules/purchase/purchase.routes.ts
// =============================================================

import Elysia, { t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { accountRateLimitRule, enforceRateLimit } from '../../lib/rate-limit'
import { purchaseEpisodes, getPurchaseHistory } from './purchase.service'

// ---- Error message map ----
function handlePurchaseError(err: any, set: any) {
  const map: Record<string, { status: number; message: string }> = {
    NO_EPISODES:           { status: 400, message: 'ต้องระบุตอนที่จะซื้ออย่างน้อย 1 ตอน' },
    TOO_MANY_EPISODES:     { status: 400, message: 'ซื้อได้สูงสุด 20 ตอนต่อครั้ง' },
    SPEND_SUSPENDED:       { status: 403, message: 'บัญชีนี้ถูกระงับการใช้จ่ายและเติมเงินชั่วคราว' },
    EPISODE_NOT_FOUND:     { status: 404, message: 'ไม่พบตอนนี้ หรือยังไม่ได้ publish' },
    CANNOT_BUY_OWN_WORK:   { status: 400, message: 'ไม่สามารถซื้องานของตัวเองได้' },
    ALREADY_PURCHASED:     { status: 400, message: 'ซื้อตอนนี้ไปแล้ว' },
    HAS_FREE_EPISODE:      { status: 400, message: 'มีตอนฟรีในรายการ ไม่ต้องซื้อ' },
    INSUFFICIENT_COINS:    { status: 402, message: 'เหรียญไม่เพียงพอ' },
  }

  const matched = map[err.message]
  if (matched) {
    set.status = matched.status
    return { success: false, message: matched.message }
  }

  throw err
}

export const purchaseRoutes = new Elysia({ prefix: '/purchase' })
  .use(authMiddleware)

  // --------------------------------------------------
  // POST /purchase/episodes
  // ซื้อตอน (ทีละตอน หรือหลายตอนพร้อมกัน สูงสุด 20)
  //
  // body: { ep_ids: number[] }
  //
  // flow:
  //   1. เช็คว่า episodes exist และ published
  //   2. เช็คว่าซื้อไปแล้วหรือเปล่า
  //   3. Atomic deduction — หักเหรียญพร้อมเช็ค balance
  //   4. สร้าง ep_shop + coin_ledger ใน transaction เดียว
  // --------------------------------------------------
  .post('/episodes', async ({ user, body, set }) => {
    const limited = await enforceRateLimit(set, [
      accountRateLimitRule('purchase-episodes', user.id, 30, 10 * 60),
    ])
    if (limited) return limited

    try {
      const epIds = body.ep_ids.map((id) => BigInt(id))
      const data  = await purchaseEpisodes(BigInt(user.id), epIds)
      set.status  = 201
      return { success: true, data }
    } catch (err: any) {
      return handlePurchaseError(err, set)
    }
  }, {
    body: t.Object({
      ep_ids: t.Array(t.Numeric(), { minItems: 1, maxItems: 20 }),
    }),
    detail: {
      summary: 'ซื้อตอน (รองรับ bulk สูงสุด 20 ตอน)',
      tags: ['Purchase'],
    },
  })

  // --------------------------------------------------
  // GET /purchase/history
  // ประวัติการซื้อตอนทั้งหมด
  // --------------------------------------------------
  .get('/history', async ({ user, query }) => {
    const data = await getPurchaseHistory(
      BigInt(user.id),
      query.page  ?? 1,
      query.limit ?? 20,
    )
    return { success: true, ...data }
  }, {
    query: t.Object({
      page:  t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
    }),
    detail: { summary: 'ประวัติการซื้อตอน', tags: ['Purchase'] },
  })
