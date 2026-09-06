import { status } from 'elysia'
import type { adminDashboardQuerySchema } from './admin-dashboard.schema'
import { getAdminDashboard } from './admin-dashboard.service'

type AdminDashboardQuery = typeof adminDashboardQuerySchema.static

export async function loadAdminDashboard(query: AdminDashboardQuery) {
  try {
    const now = new Date()
    return await getAdminDashboard(query.year ?? now.getFullYear(), query.month ?? now.getMonth() + 1)
  } catch (error) {
    console.error('Unable to load admin dashboard', error)
    return status(500, { message: 'ไม่สามารถโหลด Dashboard ได้ กรุณาลองใหม่อีกครั้ง' })
  }
}
