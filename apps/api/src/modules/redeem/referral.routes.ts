// =============================================================
// Novel Platform — Referral (ชวนเพื่อน) Routes (2026-08-18, ใหม่)
// วางไว้ที่: apps/api/src/modules/redeem/referral.routes.ts
// =============================================================

import Elysia from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { getOrCreateMyReferralCode, getMyReferrals } from './referral.service'

export const referralRoutes = new Elysia({ prefix: '/referral' })
  .use(authMiddleware)

  .get('/my-code', async ({ user }) => {
    const data = await getOrCreateMyReferralCode(BigInt(user.id))
    return { success: true, data }
  }, {
    detail: { summary: 'ดึงโค้ดชวนเพื่อนของตัวเอง (สร้างให้อัตโนมัติถ้ายังไม่เคยมี) + สถิติ', tags: ['Redeem'] },
  })

  .get('/my-referrals', async ({ user }) => {
    const data = await getMyReferrals(BigInt(user.id))
    return { success: true, data }
  }, {
    detail: { summary: 'รายชื่อเพื่อนที่แลกโค้ดชวนเพื่อนของฉัน + เหรียญที่ได้จากแต่ละคน', tags: ['Redeem'] },
  })
