import { status } from 'elysia'
import type { AuthenticatedUser } from '../../auth/auth.service'
import { resolveWriterContentAccess } from '../writer-access.service'
import { findOverviewPurchases, findOverviewSummary, type OverviewPeriod } from './writer-overview.service'

export async function getWriterOverview(
  currentUser: Pick<AuthenticatedUser, 'id' | 'role'>,
  contentId: string,
  query: { period: OverviewPeriod },
) {
  try {
    const access = await resolveWriterContentAccess(currentUser, contentId)
    const summary = await findOverviewSummary(access.creatorUserId, contentId)
    if (!summary) return status(404, { message: 'ไม่พบเรื่องที่ต้องการ' })
    const purchases = await findOverviewPurchases(access.creatorUserId, contentId, query.period)
    return { summary, period: query.period, purchases }
  } catch (error) {
    console.error('Unable to load writer overview', error)
    return status(500, { message: 'ไม่สามารถโหลดภาพรวมได้ กรุณาลองใหม่อีกครั้ง' })
  }
}
