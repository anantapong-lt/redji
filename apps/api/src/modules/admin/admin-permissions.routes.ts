// =============================================================
// Novel Platform — Admin Permissions Routes (2026-08-17, ใหม่)
// วางไว้ที่: apps/api/src/modules/admin/admin-permissions.routes.ts
// =============================================================
//
// หน้า "ตั้งค่า > สิทธิ์การใช้งาน" — level 10 เท่านั้น เข้าได้ (hardcode ตรงนี้ ไม่ผ่าน matrix เอง
// กันปัญหาไก่กับไข่ — ระบบที่ปรับสิทธิ์ต้องไม่ถูกปรับสิทธิ์ตัวเองได้)

import Elysia, { t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { getPermissionCatalog, updatePermission } from './admin-permissions.service'

export const adminPermissionsRoutes = new Elysia({ prefix: '/admin/permissions' })
  .use(authMiddleware)
  .onBeforeHandle(({ user, set }) => {
    if (user.level < 10) {
      set.status = 403
      return { success: false, message: 'เข้าหน้านี้ได้เฉพาะ level 10 เท่านั้น' }
    }
  })

  .get('/', async () => {
    const data = await getPermissionCatalog()
    return { success: true, ...data }
  }, {
    detail: { summary: 'แคตตาล็อกสิทธิ์ทั้งหมด จัดกลุ่มตามหมวดหมู่ (level 10)', tags: ['Admin Permissions'] },
  })

  .patch('/:actionKey', async ({ user, params, body, set }) => {
    try {
      await updatePermission(BigInt(user.id), params.actionKey, body.level, body.allowed)
      return { success: true }
    } catch (err: any) {
      const map: Record<string, { status: number; message: string }> = {
        PERMISSION_LEVEL_NOT_EDITABLE: { status: 400, message: 'แก้ได้เฉพาะ level 8 หรือ 9 เท่านั้น (level 10 เต็มสิทธิ์เสมอ)' },
        PERMISSION_ACTION_NOT_FOUND:   { status: 404, message: 'ไม่พบสิทธิ์นี้ในระบบ' },
      }
      const matched = map[err.message]
      if (matched) { set.status = matched.status; return { success: false, message: matched.message } }
      throw err
    }
  }, {
    params: t.Object({ actionKey: t.String() }),
    body: t.Object({
      level: t.Union([t.Literal(8), t.Literal(9)]),
      allowed: t.Boolean(),
    }),
    detail: { summary: 'เปิด/ปิดสิทธิ์ของ level 8 หรือ 9 สำหรับ action นี้ (level 10)', tags: ['Admin Permissions'] },
  })
