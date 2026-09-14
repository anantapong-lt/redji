import { status } from 'elysia'
import type { adminWriterStatusBodySchema, adminWritersQuerySchema } from './admin-writers.schema'
import { countAdminWriters, findAdminWriters, updateAdminWriterStatus } from './admin-writers.service'
import { USER_STATUS } from '../../models/user.model'

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

export async function changeAdminWriterStatus(id: string, body: typeof adminWriterStatusBodySchema.static) {
  const banReason = body.ban_reason?.trim() ?? ''
  if (body.status === USER_STATUS.BANNED && !banReason) {
    return status(400, { message: 'กรุณาระบุเหตุผลในการแบนผู้เขียน' })
  }

  try {
    const writer = await updateAdminWriterStatus(id, body.status, banReason || null)
    return writer ? { writer } : status(404, { message: 'ไม่พบนักเขียน' })
  } catch (error) {
    console.error('Unable to update admin writer status', error)
    return status(500, { message: 'ไม่สามารถเปลี่ยนสถานะนักเขียนได้' })
  }
}
