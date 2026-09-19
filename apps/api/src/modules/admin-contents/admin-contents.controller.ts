import { status } from 'elysia'
import type { adminContentsQuerySchema, hideAdminContentBodySchema } from './admin-contents.schema'
import { findAdminContents, restoreAdminContentVisibility, softDeleteAdminContent } from './admin-contents.service'
import { updateAdminContentStatus } from './admin-contents.service'
import type { adminContentStatusBodySchema } from './admin-contents.schema'

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

export async function changeAdminContentStatus(contentId: string, body: typeof adminContentStatusBodySchema.static) {
  try {
    const changed = await updateAdminContentStatus(contentId, body.status)
    return changed ? { message: 'เปลี่ยนสถานะผลงานเรียบร้อยแล้ว' } : status(404, { message: 'ไม่พบผลงาน' })
  } catch (error) {
    console.error('Unable to update admin content status', error)
    return status(500, { message: 'ไม่สามารถเปลี่ยนสถานะผลงานได้' })
  }
}

export async function hideAdminContent(contentId: string, body: typeof hideAdminContentBodySchema.static) {
  try {
    const hidden = await softDeleteAdminContent(contentId, body.reason.trim())
    if (!hidden) return status(404, { message: 'ไม่พบผลงานที่ต้องการซ่อน' })
    return { message: 'ซ่อนผลงานเรียบร้อยแล้ว' }
  } catch (error) {
    console.error('Unable to hide admin content', error)
    return status(500, { message: 'ไม่สามารถซ่อนผลงานได้ กรุณาลองใหม่อีกครั้ง' })
  }
}

export async function restoreAdminContent(contentId: string) {
  try {
    const restored = await restoreAdminContentVisibility(contentId)
    if (!restored) return status(404, { message: 'ไม่พบผลงานที่ต้องการเปิดการมองเห็น' })
    return { message: 'เปิดการมองเห็นผลงานเรียบร้อยแล้ว' }
  } catch (error) {
    console.error('Unable to restore admin content', error)
    return status(500, { message: 'ไม่สามารถเปิดการมองเห็นผลงานได้ กรุณาลองใหม่อีกครั้ง' })
  }
}
