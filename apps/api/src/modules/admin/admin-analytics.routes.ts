// =============================================================
// Novel Platform — Admin Analytics Routes (2026-08-17, ใหม่)
// วางไว้ที่: apps/api/src/modules/admin/admin-analytics.routes.ts
// =============================================================
//
// ภาพรวม/นักอ่าน/การควบคุมเนื้อหา gate ด้วย system.analytics.view (default level >= 9)
// การเงิน gate แยกด้วย system.analytics_finance.view (default level 10 เท่านั้น) — ทั้งคู่ปรับได้
// ที่หน้าตั้งค่า

import Elysia, { t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { requirePermission, PERMISSION_DENIED_MESSAGE } from '../../lib/permission-guard'
import { getSiteOverview, getReaderAnalytics, getFinanceAnalytics, getModerationAnalytics } from './admin-analytics.service'

const daysQuery = t.Object({ days: t.Optional(t.Numeric({ minimum: 7, maximum: 90 })) })

export const adminAnalyticsRoutes = new Elysia({ prefix: '/admin/analytics' })
  .use(authMiddleware)

  .get('/overview', async ({ user, set }) => {
    if (!(await requirePermission(user, 'system.analytics.view', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await getSiteOverview()
    return { success: true, data }
  }, {
    detail: { summary: 'ภาพรวมเว็บ (การ์ดตัวเลขบนสุด)', tags: ['Admin'] },
  })

  .get('/readers', async ({ user, query, set }) => {
    if (!(await requirePermission(user, 'system.analytics.view', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await getReaderAnalytics(query.days ?? 30)
    return { success: true, data }
  }, {
    query: daysQuery,
    detail: { summary: 'กราฟนักอ่าน (สมัคร/login รายวัน + จ่ายเหรียญเยอะสุด)', tags: ['Admin'] },
  })

  .get('/moderation', async ({ user, query, set }) => {
    if (!(await requirePermission(user, 'system.analytics.view', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await getModerationAnalytics(query.days ?? 30)
    return { success: true, data }
  }, {
    query: daysQuery,
    detail: { summary: 'กราฟการควบคุมเนื้อหา (รายงาน/แบน/ระงับ รายวัน)', tags: ['Admin'] },
  })

  .get('/finance', async ({ user, query, set }) => {
    if (!(await requirePermission(user, 'system.analytics_finance.view', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await getFinanceAnalytics(query.days ?? 30)
    return { success: true, data }
  }, {
    query: daysQuery,
    detail: { summary: 'กราฟการเงิน (รายได้/ยอดขาย/กำไรเว็บ/ถอนเงิน) — level 10 default', tags: ['Admin'] },
  })
