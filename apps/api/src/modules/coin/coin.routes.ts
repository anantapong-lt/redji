// =============================================================
// Novel Platform — Coin Routes
// วางไว้ที่: apps/api/src/modules/coin/coin.routes.ts
// =============================================================

import Elysia, { t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { getCoinBalance, getCoinHistory } from './coin.service'

export const coinRoutes = new Elysia({ prefix: '/coins' })
  .use(authMiddleware)

  // --------------------------------------------------
  // GET /coins/balance
  // ดูยอดเหรียญปัจจุบัน + ประวัติล่าสุด 5 รายการ
  // --------------------------------------------------
  .get('/balance', async ({ user }) => {
    const data = await getCoinBalance(BigInt(user.id))
    return { success: true, data }
  }, {
    detail: { summary: 'ยอดเหรียญและประวัติล่าสุด', tags: ['Coins'] },
  })

  // --------------------------------------------------
  // GET /coins/history
  // ประวัติ ledger ทั้งหมด แบบ paginated
  //
  // Query params:
  //   page  — หน้าที่ต้องการ (default: 1)
  //   limit — จำนวนต่อหน้า (default: 20, max: 50)
  // --------------------------------------------------
  .get('/history', async ({ user, query }) => {
    const data = await getCoinHistory(
      BigInt(user.id),
      query.page ?? 1,
      query.limit ?? 20,
    )
    return { success: true, ...data }
  }, {
    query: t.Object({
      page:  t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
    }),
    detail: { summary: 'ประวัติการใช้/รับเหรียญ', tags: ['Coins'] },
  })
