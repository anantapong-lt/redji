import { status } from 'elysia'
import type { adminContentsQuerySchema } from './admin-contents.schema'
import { findAdminContents, softDeleteAdminContent } from './admin-contents.service'

type AdminContentsQuery = typeof adminContentsQuerySchema.static

export async function getAdminContents(query: AdminContentsQuery) {
  try {
    return await findAdminContents(
      query.page ?? 1,
      query.limit ?? 20,
      query.search?.trim() ?? '',
      query.type ?? 'all',
      query.status ?? 'all',
      query.genre_id ?? null,
    )
  } catch (error) {
    console.error('Unable to load admin contents', error)
    return status(500, { message: 'ไม่สามารถโหลดรายการผลงานได้ กรุณาลองใหม่อีกครั้ง' })
  }
}

export async function hideAdminContent(contentId: string) {
  try {
    const hidden = await softDeleteAdminContent(contentId)
    if (!hidden) return status(404, { message: 'ไม่พบผลงานที่ต้องการซ่อน' })
    return { message: 'ซ่อนผลงานเรียบร้อยแล้ว' }
  } catch (error) {
    console.error('Unable to hide admin content', error)
    return status(500, { message: 'ไม่สามารถซ่อนผลงานได้ กรุณาลองใหม่อีกครั้ง' })
  }
}
