// =============================================================
// Novel Platform — Admin Tags Routes (2026-08-17, ใหม่)
// วางไว้ที่: apps/api/src/modules/admin/admin-tags.routes.ts
// =============================================================
//
// หน้า "ตั้งหน้าเว็บไซต์ > หมวดหมู่ย่อย" — gate ด้วย content.tags.manage (ปรับได้ที่หน้าตั้งค่า)
// ใช้ tag id (ไม่ใช่ name) เป็น path param เสมอ กันปัญหา encode ชื่อ tag ที่อาจมีอักขระพิเศษ/
// เครื่องหมาย / ปนอยู่ (เป็น free-text ที่นักเขียนพิมพ์เองได้)

import Elysia, { t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { requirePermission, PERMISSION_DENIED_MESSAGE } from '../../lib/permission-guard'
import { getTagsAdmin, getWorksForTag, detachTagFromWork, deleteTagEverywhere } from './admin-tags.service'

function handleTagsError(err: any, set: any) {
  const map: Record<string, { status: number; message: string }> = {
    WORK_NOT_FOUND: { status: 404, message: 'ไม่พบเรื่องนี้ (อาจถูกลบไปแล้ว)' },
    TAG_NOT_FOUND:  { status: 404, message: 'ไม่พบหมวดหมู่ย่อยนี้ (อาจถูกลบไปแล้ว)' },
  }
  const matched = map[err.message]
  if (matched) {
    set.status = matched.status
    return { success: false, message: matched.message }
  }
  throw err
}

export const adminTagsRoutes = new Elysia({ prefix: '/admin/tags' })
  .use(authMiddleware)

  .get('/', async ({ user, query, set }) => {
    if (!(await requirePermission(user, 'content.tags.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    const data = await getTagsAdmin(query.page ?? 1, query.limit ?? 50)
    return { success: true, ...data }
  }, {
    query: t.Object({
      page: t.Optional(t.Numeric({ minimum: 1 })),
      limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
    }),
    detail: { summary: 'รายการหมวดหมู่ย่อย (tag) ทั้งหมด เรียงตามจำนวนที่ใช้', tags: ['Admin'] },
  })

  .get('/:id/works', async ({ user, params, set }) => {
    if (!(await requirePermission(user, 'content.tags.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      const data = await getWorksForTag(BigInt(params.id))
      return { success: true, data }
    } catch (err: any) { return handleTagsError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'รายชื่อเรื่องที่ใส่หมวดหมู่ย่อยนี้', tags: ['Admin'] },
  })

  .delete('/:id/works/:pId', async ({ user, params, set }) => {
    if (!(await requirePermission(user, 'content.tags.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      await detachTagFromWork(BigInt(params.pId), BigInt(params.id))
      return { success: true, message: 'ถอดหมวดหมู่ย่อยออกจากเรื่องนี้แล้ว' }
    } catch (err: any) { return handleTagsError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }), pId: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'ถอดหมวดหมู่ย่อยออกจากเรื่องเดียว', tags: ['Admin'] },
  })

  .delete('/:id', async ({ user, params, set }) => {
    if (!(await requirePermission(user, 'content.tags.manage', set))) {
      return { success: false, message: PERMISSION_DENIED_MESSAGE }
    }
    try {
      const result = await deleteTagEverywhere(BigInt(params.id))
      return { success: true, ...result, message: `ลบหมวดหมู่ย่อยนี้ออกจาก ${result.affected_work_count} เรื่องถาวรแล้ว` }
    } catch (err: any) { return handleTagsError(err, set) }
  }, {
    params: t.Object({ id: t.String({ pattern: '^[0-9]+$' }) }),
    detail: { summary: 'ลบหมวดหมู่ย่อยทิ้งถาวรจากทุกเรื่อง', tags: ['Admin'] },
  })
