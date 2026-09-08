import { status } from 'elysia'
import type { adminWritersQuerySchema } from './admin-writers.schema'
import { countAdminWriters, findAdminWriters } from './admin-writers.service'

export async function getAdminWriters(query: typeof adminWritersQuerySchema.static) {
  try {
    const limit = query.limit ?? 20
    const search = query.search?.trim() ?? ''
    const selectedStatus = query.status ?? null
    const total = await countAdminWriters(search, selectedStatus)
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const page = Math.min(query.page ?? 1, totalPages)
    const writers = await findAdminWriters(page, limit, search, selectedStatus)
    return { writers, pagination: { page, limit, total, totalPages } }
  } catch (error) {
    console.error('Unable to load admin writers', error)
    return status(500, { message: 'ไม่สามารถโหลดรายชื่อนักเขียนได้' })
  }
}
