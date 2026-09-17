import { status } from 'elysia'
import type { adminPurchaseStoriesQuerySchema, adminPurchaseUsersQuerySchema, adminPurchasesQuerySchema } from './admin-purchases.schema'
import { countAdminPurchases, findAdminPurchases, findAdminPurchaseStories, findAdminPurchaseUsers } from './admin-purchases.service'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseUserIds(value: string | undefined): string[] | null {
  if (!value) return []
  const ids = [...new Set(value.split(',').filter(Boolean))]
  if (ids.length > 50 || ids.some((id) => !UUID_PATTERN.test(id))) return null
  return ids
}

export async function getAdminPurchases(query: typeof adminPurchasesQuerySchema.static) {
  const dateFrom = query.date_from ?? null
  const dateTo = query.date_to ?? null
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return status(400, { message: 'วันเริ่มต้นต้องไม่เกินวันสิ้นสุด' })
  }
  const userIds = parseUserIds(query.user_ids)
  if (!userIds) return status(400, { message: 'ข้อมูลผู้ใช้สำหรับตัวกรองไม่ถูกต้อง' })

  try {
    const limit = query.limit ?? 20
    const storyId = query.story_id ?? null
    const total = await countAdminPurchases(storyId, userIds, dateFrom, dateTo)
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const page = Math.min(query.page ?? 1, totalPages)
    const purchases = await findAdminPurchases(page, limit, storyId, userIds, dateFrom, dateTo)
    return { purchases, pagination: { page, limit, total, totalPages } }
  } catch (error) {
    console.error('Unable to load admin purchases', error)
    return status(500, { message: 'ไม่สามารถโหลดประวัติการซื้อได้' })
  }
}

export async function getAdminPurchaseUsers(query: typeof adminPurchaseUsersQuerySchema.static) {
  try {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const users = await findAdminPurchaseUsers(query.search?.trim() ?? '', page, limit)
    return { users, pagination: { page, limit, hasNextPage: users.length === limit } }
  } catch (error) {
    console.error('Unable to load admin purchase users', error)
    return status(500, { message: 'ไม่สามารถโหลดรายการผู้ใช้งานได้' })
  }
}

export async function getAdminPurchaseStories(query: typeof adminPurchaseStoriesQuerySchema.static) {
  try {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const stories = await findAdminPurchaseStories(query.search?.trim() ?? '', page, limit)
    return {
      stories,
      pagination: { page, limit, hasNextPage: stories.length === limit },
    }
  } catch (error) {
    console.error('Unable to load admin purchase stories', error)
    return status(500, { message: 'ไม่สามารถโหลดรายการเรื่องได้' })
  }
}
