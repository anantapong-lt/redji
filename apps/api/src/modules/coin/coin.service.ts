// =============================================================
// Novel Platform — Coin Service
// วางไว้ที่: apps/api/src/modules/coin/coin.service.ts
// =============================================================
//
// หน้าที่: ให้ user ดูยอดเหรียญปัจจุบัน และประวัติ ledger
//
// ❗ ห้ามแก้ไข coin_ledger โดยตรงที่นี่
//    ไฟล์นี้มีแค่ READ — การเพิ่ม/ลดเหรียญอยู่ใน topup.service และ purchase.service
// =============================================================

import { db } from '../../db'

// =============================================================
// ดูยอดเหรียญปัจจุบัน
// =============================================================

export async function getCoinBalance(userId: bigint) {
  const user = await db
    .selectFrom('users')
    .select(['point'])
    .where('id', '=', userId)
    .executeTakeFirstOrThrow()

  // ดึง 5 รายการล่าสุดด้วย เพื่อ mini history บนหน้า wallet
  const recent = await db
    .selectFrom('coin_ledger')
    .select(['id', 'delta', 'reason', 'ref_type', 'ref_id', 'balance_after', 'created_at'])
    .where('user_id', '=', userId)
    .orderBy('created_at', 'desc')
    .limit(5)
    .execute()

  return {
    balance: String(user.point),
    recent: recent.map((r) => ({
      id:           String(r.id),
      delta:        String(r.delta),   // + = ได้รับ, - = ใช้ไป
      reason:       r.reason,          // 'topup' | 'purchase' | 'refund' | 'admin_adjust' | 'withdrawal'
      ref_type:     r.ref_type,
      ref_id:       r.ref_id ? String(r.ref_id) : null,
      balance_after: String(r.balance_after),
      created_at:   r.created_at,
    })),
  }
}

// =============================================================
// ประวัติ ledger แบบ paginated
// =============================================================

export async function getCoinHistory(userId: bigint, page: number, limit: number) {
  const offset = (page - 1) * limit

  const rows = await db
    .selectFrom('coin_ledger')
    .select(['id', 'delta', 'reason', 'ref_type', 'ref_id', 'balance_after', 'created_at'])
    .where('user_id', '=', userId)
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  const countRow = await db
    .selectFrom('coin_ledger')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('user_id', '=', userId)
    .executeTakeFirstOrThrow()

  const total = Number(countRow.total)

  return {
    data: rows.map((r) => ({
      id:           String(r.id),
      delta:        String(r.delta),
      reason:       r.reason,
      ref_type:     r.ref_type,
      ref_id:       r.ref_id ? String(r.ref_id) : null,
      balance_after: String(r.balance_after),
      created_at:   r.created_at,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  }
}
