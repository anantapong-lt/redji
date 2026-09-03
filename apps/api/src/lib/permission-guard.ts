// =============================================================
// Novel Platform — Permission Guard Helper (2026-08-17, ใหม่)
// วางไว้ที่: apps/api/src/lib/permission-guard.ts
// =============================================================
//
// Helper กลางให้ทุก /admin/** route เรียกแทน `if (user.level < 9) { ... }` แบบเดิม —
// เช็คผ่านตาราง permission_matrix (ปรับได้จากหน้า "ตั้งค่า" โดย level 10) แทนเลข level ตายตัว
//
// ใช้แบบ:
//   if (!(await requirePermission(user, 'economy.withdrawal.manage', set))) {
//     return { success: false, message: PERMISSION_DENIED_MESSAGE }
//   }

import { hasPermission } from '../modules/admin/admin-permissions.service'

export const PERMISSION_DENIED_MESSAGE = 'ไม่มีสิทธิ์ทำรายการนี้ — ปรับสิทธิ์ได้ที่หน้า "ตั้งค่า" (level 10 เท่านั้น)'

export async function requirePermission(user: { level: number }, actionKey: string, set: any): Promise<boolean> {
  const allowed = await hasPermission(user.level, actionKey)
  if (!allowed) set.status = 403
  return allowed
}
