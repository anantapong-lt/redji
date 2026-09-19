import { status } from 'elysia'
import type { adminTopupsQuerySchema } from './admin-topups.schema'
import { countAdminTopups, findAdminTopups } from './admin-topups.service'

export async function getAdminTopups(query: typeof adminTopupsQuerySchema.static) {
  const dateFrom = query.date_from ?? null
  const dateTo = query.date_to ?? null

  if (dateFrom && dateTo && dateFrom > dateTo) {
    return status(400, { message: 'วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด' })
  }

  try {
    const limit = query.limit ?? 20
    const filters = {
      search: query.search?.trim() ?? '',
      status: !query.status || query.status === 'all' ? null : query.status,
      dateFrom,
      dateTo,
    }
    const total = await countAdminTopups(filters)
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const page = Math.min(query.page ?? 1, totalPages)
    const topups = await findAdminTopups(page, limit, filters)

    return { topups, pagination: { page, limit, total, totalPages } }
  } catch (error) {
    console.error('Unable to load admin topups', error)
    return status(500, { message: 'ไม่สามารถโหลดรายการเติมเงินได้' })
  }
}
