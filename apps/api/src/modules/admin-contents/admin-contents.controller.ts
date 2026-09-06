import { status } from 'elysia'
import type { adminContentsQuerySchema } from './admin-contents.schema'
import { findAdminContents } from './admin-contents.service'

type AdminContentsQuery = typeof adminContentsQuerySchema.static

export async function getAdminContents(query: AdminContentsQuery) {
  try {
    return await findAdminContents(
      query.page ?? 1,
      query.limit ?? 20,
      query.search?.trim() ?? '',
      query.type ?? null,
      query.status ?? null,
      query.genre_id ?? null,
    )
  } catch (error) {
    console.error('Unable to load admin contents', error)
    return status(500, { message: 'ไม่สามารถโหลดรายการผลงานได้ กรุณาลองใหม่อีกครั้ง' })
  }
}
