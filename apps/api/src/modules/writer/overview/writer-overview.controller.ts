import { status } from 'elysia'
import { findOverviewPurchases, findOverviewSummary, type OverviewPeriod } from './writer-overview.service'

export async function getWriterOverview(
  userId: string,
  contentId: string,
  query: { period: OverviewPeriod },
) {
  try {
    const summary = await findOverviewSummary(userId, contentId)
    if (!summary) return status(404, { message: 'ไม่พบเรื่องที่ต้องการ' })
    const purchases = await findOverviewPurchases(userId, contentId, query.period)
    return { summary, period: query.period, purchases }
  } catch (error) {
    console.error('Unable to load writer overview', error)
    return status(500, { message: 'ไม่สามารถโหลดภาพรวมได้ กรุณาลองใหม่อีกครั้ง' })
  }
}
