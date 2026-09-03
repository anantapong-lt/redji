// =============================================================
// Novel Platform — Feed Routes
// วางไว้ที่: apps/api/src/modules/feed/feed.routes.ts
// 2026-07-29: หน้า Feed (personalized) — ทุก endpoint ต้องล็อกอิน (มี authMiddleware ในตัว
// เหมือน socialRoutes) เพราะเนื้อหาผูกกับตัว user เองล้วนๆ (อ่านล่าสุด/บุ๊คมาร์ค/ที่ follow)
// =============================================================

import Elysia, { t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { getRecentlyReadFeed, getStarredUpdatesFeed, getFollowedWritersFeed } from '../social/social.service'

export const feedRoutes = new Elysia({ prefix: '/feed' })
  .use(authMiddleware)

  // --------------------------------------------------
  // GET /feed/recently-read — เรื่องที่อ่านล่าสุด (per เรื่อง, พร้อมเลขตอน)
  // --------------------------------------------------
  .get(
    '/recently-read',
    async ({ user, query }) => {
      const data = await getRecentlyReadFeed(BigInt(user.id), query.limit ?? 10)
      return { success: true, data }
    },
    {
      query: t.Object({ limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })) }),
      detail: { summary: 'อ่านล่าสุด (teaser row สำหรับหน้า Feed)', tags: ['Feed'] },
    }
  )

  // --------------------------------------------------
  // GET /feed/starred-updates — เรื่องที่กดดาว (บุ๊คมาร์คที่มีตอนใหม่ยังไม่ได้อ่าน)
  // --------------------------------------------------
  .get(
    '/starred-updates',
    async ({ user, query }) => {
      const data = await getStarredUpdatesFeed(BigInt(user.id), query.limit ?? 10)
      return { success: true, data }
    },
    {
      query: t.Object({ limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })) }),
      detail: { summary: 'เรื่องที่กดดาว (บุ๊คมาร์คที่มีตอนใหม่ยังไม่ได้อ่าน)', tags: ['Feed'] },
    }
  )

  // --------------------------------------------------
  // GET /feed/followed-writers — ผลงานล่าสุดของนักเขียนที่ติดตาม
  // --------------------------------------------------
  .get(
    '/followed-writers',
    async ({ user, query }) => {
      const data = await getFollowedWritersFeed(BigInt(user.id), query.limit ?? 12)
      return { success: true, data }
    },
    {
      query: t.Object({ limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })) }),
      detail: { summary: 'ผลงานล่าสุดของนักเขียนที่ติดตาม', tags: ['Feed'] },
    }
  )
