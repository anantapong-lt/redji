import { status } from 'elysia'
import { countAdminUsers, findAdminUsers } from './admin-users.service'
import type { adminUsersQuerySchema } from './admin-users.schema'

export async function getAdminUsers(query: typeof adminUsersQuerySchema.static) {
  try {
    const limit = query.limit ?? 20
    const search = query.search?.trim() ?? ''
    const selectedStatus = query.status ?? null
    const total = await countAdminUsers(search, selectedStatus)
    const totalPages = Math.ceil(total / limit)
    const page = Math.min(query.page ?? 1, Math.max(totalPages, 1))
    const users = await findAdminUsers(page, limit, search, selectedStatus)

    return { users, pagination: { page, limit, total, totalPages } }
  } catch (error) {
    console.error('Unable to load admin users', error)
    return status(500, { message: 'ไม่สามารถโหลดรายชื่อผู้ใช้ได้ กรุณาลองใหม่อีกครั้ง' })
  }
}
