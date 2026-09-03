// =============================================================
// Novel Platform — Admin Permission Matrix Service (2026-08-17, ใหม่)
// วางไว้ที่: apps/api/src/modules/admin/admin-permissions.service.ts
// =============================================================
//
// ระบบสิทธิ์แบบปรับได้เอง (ฟีลคล้าย Discord role permission) — level 10 ปรับได้เองใน
// apps/admin หน้า "ตั้งค่า" ว่า level 8/9 ทำ action ไหนได้บ้าง โดยไม่ต้องแก้โค้ด/redeploy
//
// level 10 (shareholder) ไม่ถูกกรองโดยตารางนี้เลย — short-circuit คืน true เสมอในนี้ (ไม่ใช่แค่
// seed data เป็น true) กันเจ้าของเว็บกดพลาดจนล็อกตัวเองออกจากระบบ
//
// Cache: hasPermission() ถูกเรียกแทบทุก request ของ /admin/** จึงแคช matrix ทั้งก้อนไว้ใน memory
// (TTL 30s) แทนที่จะ query ทุกครั้ง — invalidate ทันทีเมื่อมีการแก้ค่าผ่าน updatePermission()

import { db } from '../../db'

const CACHE_TTL_MS = 30_000

let cache: Map<string, Record<number, boolean>> | null = null
let cacheLoadedAt = 0

async function loadMatrix(): Promise<Map<string, Record<number, boolean>>> {
  const rows = await db.selectFrom('permission_matrix').select(['action_key', 'level', 'allowed']).execute()
  const map = new Map<string, Record<number, boolean>>()
  for (const row of rows) {
    const entry = map.get(row.action_key) ?? {}
    entry[row.level] = row.allowed
    map.set(row.action_key, entry)
  }
  return map
}

async function getMatrixCached(): Promise<Map<string, Record<number, boolean>>> {
  const now = Date.now()
  if (!cache || now - cacheLoadedAt > CACHE_TTL_MS) {
    cache = await loadMatrix()
    cacheLoadedAt = now
  }
  return cache
}

function invalidateCache() {
  cache = null
}

// ---- เช็คสิทธิ์ — ใช้ตรงนี้แทน `if (user.level < 9)` เดิมทุกจุด ----
export async function hasPermission(level: number, actionKey: string): Promise<boolean> {
  if (level >= 10) return true // shareholder เต็มสิทธิ์เสมอ ไม่ผ่าน matrix เลย
  const matrix = await getMatrixCached()
  const row = matrix.get(actionKey)
  if (!row) return false // action ที่ไม่รู้จัก/ยังไม่ seed = ปิดไว้ก่อน (fail-closed)
  return row[level] === true
}

// ---- ดึงแคตตาล็อก + matrix ทั้งหมด จัดกลุ่มตาม category ให้หน้า UI ----
export async function getPermissionCatalog() {
  const [actions, matrixRows] = await Promise.all([
    db.selectFrom('permission_actions').selectAll().orderBy('category').orderBy('sort_order').execute(),
    db.selectFrom('permission_matrix').select(['action_key', 'level', 'allowed']).execute(),
  ])

  const matrixByAction = new Map<string, Record<number, boolean>>()
  for (const row of matrixRows) {
    const entry = matrixByAction.get(row.action_key) ?? {}
    entry[row.level] = row.allowed
    matrixByAction.set(row.action_key, entry)
  }

  const categories = new Map<string, { category: string; actions: any[] }>()
  for (const action of actions) {
    if (!categories.has(action.category)) categories.set(action.category, { category: action.category, actions: [] })
    const levels = matrixByAction.get(action.key) ?? {}
    categories.get(action.category)!.actions.push({
      key: action.key,
      label: action.label,
      description: action.description,
      levels: { 8: levels[8] ?? false, 9: levels[9] ?? false, 10: true },
    })
  }

  return { categories: [...categories.values()] }
}

// ---- แก้ค่า cell เดียวในตาราง (level 8 หรือ 9 เท่านั้น — level 10 แก้ไม่ได้เพราะเต็มสิทธิ์เสมออยู่แล้ว) ----
export async function updatePermission(adminId: bigint, actionKey: string, level: number, allowed: boolean) {
  if (level !== 8 && level !== 9) throw new Error('PERMISSION_LEVEL_NOT_EDITABLE')

  const action = await db.selectFrom('permission_actions').select('key').where('key', '=', actionKey).executeTakeFirst()
  if (!action) throw new Error('PERMISSION_ACTION_NOT_FOUND')

  await db
    .updateTable('permission_matrix')
    .set({ allowed, updated_at: new Date(), updated_by: adminId })
    .where('action_key', '=', actionKey)
    .where('level', '=', level)
    .execute()

  invalidateCache()
}
