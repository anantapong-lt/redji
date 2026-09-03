// =============================================================
// Novel Platform — Admin Redeem Codes Service (2026-08-18, ใหม่)
// วางไว้ที่: apps/api/src/modules/admin/admin-redeem-codes.service.ts
// =============================================================
//
// หน้า "จัดการธุรกรรม > โค้ดส่วนลด/เติมเหรียญ" — สร้าง/แก้ไข/ปิดใช้งานโค้ด + ดูประวัติการแลก
// ตัวการแลกโค้ดจริง (ฝั่งผู้ใช้) อยู่ที่ redeem.service.ts แยกต่างหาก ไฟล์นี้จัดการแค่ฝั่งแอดมิน

import { db } from '../../db'

function toStr(val: bigint | null | undefined): string | null {
  return val === null || val === undefined ? null : String(val)
}

export interface RedeemCodeInput {
  code:                string
  type:                'instant_coins' | 'topup_bonus_percent'
  value:               number
  bonus_window_hours?: number | null
  max_uses?:           number | null
  max_uses_per_user?:  number
  valid_from?:         string | null
  valid_until?:        string | null
  label?:              string | null
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase()
}

function validateValue(type: string, value: number) {
  if (!Number.isFinite(value) || value <= 0) throw new Error('INVALID_VALUE')
  if (type === 'topup_bonus_percent' && value > 100) throw new Error('INVALID_PERCENT')
}

// ---- GET /admin/redeem-codes ----
export async function getRedeemCodesAdmin(page: number, limit: number) {
  const offset = (page - 1) * limit

  const rows = await db
    .selectFrom('redeem_codes')
    .selectAll()
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  const totalRow = await db.selectFrom('redeem_codes').select(({ fn }) => fn.countAll<string>().as('total')).executeTakeFirstOrThrow()

  return {
    data: rows.map((r) => ({
      id:                 toStr(r.id)!,
      code:               r.code,
      type:               r.type,
      value:              r.value,
      bonus_window_hours: r.bonus_window_hours,
      max_uses:           r.max_uses,
      max_uses_per_user:  r.max_uses_per_user,
      used_count:         r.used_count,
      valid_from:         r.valid_from,
      valid_until:        r.valid_until,
      label:              r.label,
      status:             r.status,
      created_at:         r.created_at,
      updated_at:         r.updated_at,
    })),
    pagination: { page, limit, total: Number(totalRow.total), pages: Math.ceil(Number(totalRow.total) / limit) },
  }
}

// ---- POST /admin/redeem-codes ----
export async function createRedeemCode(adminId: bigint, input: RedeemCodeInput) {
  const code = normalizeCode(input.code)
  if (!code) throw new Error('CODE_REQUIRED')
  validateValue(input.type, input.value)

  const existing = await db.selectFrom('redeem_codes').select('id').where('code', '=', code).executeTakeFirst()
  if (existing) throw new Error('CODE_TAKEN')

  const row = await db
    .insertInto('redeem_codes')
    .values({
      code,
      type:               input.type,
      value:              String(input.value),
      bonus_window_hours: input.type === 'topup_bonus_percent' ? (input.bonus_window_hours ?? null) : null,
      max_uses:           input.max_uses ?? null,
      max_uses_per_user:  input.max_uses_per_user ?? 1,
      used_count:         0,
      valid_from:         input.valid_from ? new Date(input.valid_from) : null,
      valid_until:        input.valid_until ? new Date(input.valid_until) : null,
      label:              input.label?.trim() || null,
      status:             'active',
      created_by:         adminId,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow()

  return { id: toStr(row.id)! }
}

// ---- PATCH /admin/redeem-codes/:id ----
// แก้ได้แค่ค่าที่ไม่กระทบประวัติเก่า (code/type ห้ามแก้ — ถ้าอยากเปลี่ยนให้สร้างโค้ดใหม่แทน
// เพราะ redeem_code_uses เก็บ snapshot type/value ไว้แล้ว แก้ต้นทางทีหลังไม่กระทบของเก่าอยู่แล้ว
// แต่การเปลี่ยน "ความหมาย" ของโค้ดที่แจกไปแล้วจะสร้างความสับสน)
export async function updateRedeemCode(id: bigint, input: Partial<Omit<RedeemCodeInput, 'code' | 'type'>> & { status?: 'active' | 'disabled' }) {
  const existing = await db.selectFrom('redeem_codes').selectAll().where('id', '=', id).executeTakeFirst()
  if (!existing) throw new Error('REDEEM_CODE_NOT_FOUND')

  if (input.value !== undefined) validateValue(existing.type, input.value)

  await db
    .updateTable('redeem_codes')
    .set({
      ...(input.value !== undefined ? { value: String(input.value) } : {}),
      ...(input.bonus_window_hours !== undefined ? { bonus_window_hours: input.bonus_window_hours } : {}),
      ...(input.max_uses !== undefined ? { max_uses: input.max_uses } : {}),
      ...(input.max_uses_per_user !== undefined ? { max_uses_per_user: input.max_uses_per_user } : {}),
      ...(input.valid_from !== undefined ? { valid_from: input.valid_from ? new Date(input.valid_from) : null } : {}),
      ...(input.valid_until !== undefined ? { valid_until: input.valid_until ? new Date(input.valid_until) : null } : {}),
      ...(input.label !== undefined ? { label: input.label?.trim() || null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updated_at: new Date(),
    })
    .where('id', '=', id)
    .execute()

  return { id: toStr(id)! }
}

// ---- GET /admin/redeem-codes/:id/uses — ประวัติการแลกของโค้ดหนึ่งใบ ----
export async function getRedeemCodeUses(codeId: bigint, page: number, limit: number) {
  const offset = (page - 1) * limit

  const codeRow = await db.selectFrom('redeem_codes').select('id').where('id', '=', codeId).executeTakeFirst()
  if (!codeRow) throw new Error('REDEEM_CODE_NOT_FOUND')

  const rows = await db
    .selectFrom('redeem_code_uses as u')
    .innerJoin('users as usr', 'usr.id', 'u.user_id')
    .select([
      'u.id', 'u.type', 'u.value', 'u.status', 'u.expires_at', 'u.consumed_at',
      'u.consumed_topup_id', 'u.redeemed_at',
      'usr.uuid as user_uuid', 'usr.display_name as user_display_name', 'usr.u_name as user_u_name',
    ])
    .where('u.code_id', '=', codeId)
    .orderBy('u.redeemed_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  const totalRow = await db
    .selectFrom('redeem_code_uses')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('code_id', '=', codeId)
    .executeTakeFirstOrThrow()

  return {
    data: rows.map((r) => ({
      id:                 toStr(r.id)!,
      type:               r.type,
      value:              r.value,
      status:             r.status,
      expires_at:         r.expires_at,
      consumed_at:        r.consumed_at,
      consumed_topup_id:  toStr(r.consumed_topup_id),
      redeemed_at:        r.redeemed_at,
      user:               { uuid: r.user_uuid, display_name: r.user_display_name, u_name: r.user_u_name },
    })),
    pagination: { page, limit, total: Number(totalRow.total), pages: Math.ceil(Number(totalRow.total) / limit) },
  }
}
