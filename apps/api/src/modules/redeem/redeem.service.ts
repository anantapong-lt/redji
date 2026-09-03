// =============================================================
// Novel Platform — Redeem Code Service (2026-08-18, ใหม่)
// วางไว้ที่: apps/api/src/modules/redeem/redeem.service.ts
// =============================================================
//
// ปุ่ม "ใช้โค้ด" ในเนวบาร์ — รองรับ 3 ประเภท:
//   1. instant_coins       — แลกแล้วบวกเหรียญเข้าบัญชีทันที (เขียน coin_ledger ทันที)
//   2. topup_bonus_percent — แลกแล้วเปิดสิทธิ์โบนัส % ไว้รอ (redeem_code_uses.status='pending')
//      ใช้ได้ครั้งเดียว มีเวลาจำกัด (bonus_window_hours ชม. หลังแลก) — พอเติมเงินครั้งถัดไปภายใน
//      เวลานั้น completeTopupTransaction() (topup.service.ts) จะมาเช็คแล้ว credit โบนัสให้เอง
//   3. referral            — โค้ดชวนเพื่อน (auto-gen ต่อ user คนละใบ ดู referral.service.ts) แลกแล้ว
//      คนกรอก (invitee) ได้ REFERRAL_SIGNUP_BONUS_COINS ทันที + สร้างความสัมพันธ์ถาวร
//      (redeem_code_uses.status='active' ไม่มีวันเปลี่ยน) ให้เจ้าของโค้ด (redeem_codes.created_by)
//      ได้ REFERRAL_COMMISSION_PERCENT ของเหรียญที่ invitee เติมเงิน "ทุกครั้ง" (ไม่ใช่ครั้งเดียว) —
//      ดู completeTopupTransaction() สำหรับส่วนที่ credit ค่าคอมมิชชั่นจริง
//
// Concurrency: ล็อกแถว redeem_codes ด้วย FOR UPDATE ก่อนเช็ค/แก้อะไรเสมอ — เพราะ used_count/
// max_uses/max_uses_per_user ต้องนับให้ถูกแม้มีคนแลกโค้ดเดียวกันพร้อมกันหลายคน (ล็อกนี้ serialize
// การแลกโค้ด "อันเดียวกัน" ทีละคน ไม่กระทบการแลกโค้ดคนละใบพร้อมกัน)

import { sql } from 'kysely'
import type { Transaction } from 'kysely'
import { db } from '../../db'
import type { DB } from '../../db/types'

const DEFAULT_BONUS_WINDOW_HOURS = 72 // 3 วัน — ใช้เมื่อแอดมินไม่ได้ตั้ง bonus_window_hours ไว้เอง
export const REFERRAL_SIGNUP_BONUS_COINS = 10 // เหรียญที่ invitee ได้ทันทีตอนกรอกโค้ดชวนเพื่อน
export const REFERRAL_COMMISSION_PERCENT = 1  // % ที่ referrer ได้จากทุกยอดเติมเงินของ invitee

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase()
}

// ---- บวกเหรียญเข้าบัญชี + เขียน coin_ledger + ผูก ledger_id กลับเข้า redeem_code_uses ----
// ใช้ร่วมกันทั้ง instant_coins และโบนัสสมัครของ referral
async function creditCoins(
  trx: Transaction<DB>,
  userId: bigint,
  amount: bigint,
  useId: bigint,
  idempotencyKey: string,
) {
  const updatedUser = await trx
    .updateTable('users')
    .set({ point: sql<bigint>`point + ${amount}` as any }) // point เป็น ColumnType<bigint, never, never> (readonly ใน types.ts) — as any จำเป็น เหมือน purchase.service.ts
    .where('id', '=', userId)
    .returning('point')
    .executeTakeFirstOrThrow()

  const ledgerRow = await trx
    .insertInto('coin_ledger')
    .values({
      user_id:         userId,
      delta:           amount,
      reason:          'redeem_code',
      ref_type:        'redeem_code_use',
      ref_id:          useId,
      idempotency_key: idempotencyKey,
      balance_after:   updatedUser.point,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow()

  await trx.updateTable('redeem_code_uses').set({ ledger_id: ledgerRow.id }).where('id', '=', useId).execute()

  return updatedUser.point
}

export async function redeemCode(userId: bigint, rawCode: string) {
  const code = normalizeCode(rawCode)
  if (!code) throw new Error('CODE_REQUIRED')

  return db.transaction().execute(async (trx) => {
    const codeRow = await trx
      .selectFrom('redeem_codes')
      .selectAll()
      .where('code', '=', code)
      .forUpdate()
      .executeTakeFirst()

    if (!codeRow) throw new Error('CODE_NOT_FOUND')
    if (codeRow.status !== 'active') throw new Error('CODE_DISABLED')

    const now = new Date()
    if (codeRow.valid_from && codeRow.valid_from > now) throw new Error('CODE_NOT_YET_VALID')
    if (codeRow.valid_until && codeRow.valid_until < now) throw new Error('CODE_EXPIRED')
    if (codeRow.max_uses !== null && codeRow.used_count >= codeRow.max_uses) throw new Error('CODE_MAX_USES_REACHED')

    const userUseCount = await trx
      .selectFrom('redeem_code_uses')
      .select(({ fn }) => fn.countAll<string>().as('c'))
      .where('code_id', '=', codeRow.id)
      .where('user_id', '=', userId)
      .executeTakeFirstOrThrow()

    if (Number(userUseCount.c) >= codeRow.max_uses_per_user) throw new Error('ALREADY_REDEEMED')

    if (codeRow.type === 'topup_bonus_percent') {
      // กันแลกโบนัสซ้อนกัน — ต้องใช้สิทธิ์เดิมให้หมด (เติมเงินสำเร็จ หรือหมดเวลา) ก่อนแลกใบใหม่
      const existingPending = await trx
        .selectFrom('redeem_code_uses')
        .select('id')
        .where('user_id', '=', userId)
        .where('status', '=', 'pending')
        .where('expires_at', '>', now)
        .executeTakeFirst()

      if (existingPending) throw new Error('BONUS_ALREADY_ACTIVE')

      const windowHours = codeRow.bonus_window_hours ?? DEFAULT_BONUS_WINDOW_HOURS
      const expiresAt = new Date(now.getTime() + windowHours * 60 * 60 * 1000)

      await trx
        .insertInto('redeem_code_uses')
        .values({
          code_id:    codeRow.id,
          user_id:    userId,
          type:       codeRow.type,
          value:      codeRow.value,
          status:     'pending',
          expires_at: expiresAt,
        })
        .execute()

      await trx
        .updateTable('redeem_codes')
        .set({ used_count: sql`used_count + 1`, updated_at: now })
        .where('id', '=', codeRow.id)
        .execute()

      return {
        type:       'topup_bonus_percent' as const,
        percent:    Number(codeRow.value),
        expires_at: expiresAt,
      }
    }

    if (codeRow.type === 'referral') {
      // ห้ามใช้โค้ดตัวเอง — created_by เป็น bigint column แต่ pg driver คืนเป็น string เสมอ
      // ต้อง BigInt() ก่อนเทียบกับ userId (bigint จริง) ไม่งั้น "141" === 141n จะเป็น false เสมอ
      if (codeRow.created_by !== null && BigInt(codeRow.created_by) === userId) throw new Error('CANNOT_REDEEM_OWN_CODE')

      // กันโดนเชิญซ้ำสอง — คนหนึ่งเป็น invitee ได้แค่ครั้งเดียวตลอดไป (ทุกโค้ดชวนเพื่อนรวมกัน)
      // ไม่ใช่แค่ต่อโค้ดเดียว ไม่งั้นสร้าง alt account มาชวนตัวเองซ้ำๆ ได้เหรียญฟรีไม่จำกัด
      const alreadyReferred = await trx
        .selectFrom('redeem_code_uses')
        .select('id')
        .where('user_id', '=', userId)
        .where('type', '=', 'referral')
        .executeTakeFirst()

      if (alreadyReferred) throw new Error('ALREADY_REFERRED')

      const use = await trx
        .insertInto('redeem_code_uses')
        .values({
          code_id: codeRow.id,
          user_id: userId,
          type:    codeRow.type,
          value:   codeRow.value,
          status:  'active', // ถาวร ไม่มีวันเปลี่ยนเป็น consumed — เช็คซ้ำได้ทุกครั้งที่ invitee เติมเงิน
        })
        .returning(['id'])
        .executeTakeFirstOrThrow()

      const bonusCoins = BigInt(REFERRAL_SIGNUP_BONUS_COINS)
      const newBalance = await creditCoins(trx, userId, bonusCoins, use.id, `redeem_code:${use.id}`)

      await trx
        .updateTable('redeem_codes')
        .set({ used_count: sql`used_count + 1`, updated_at: now })
        .where('id', '=', codeRow.id)
        .execute()

      return {
        type:        'referral' as const,
        coins:       Number(bonusCoins),
        new_balance: String(newBalance),
      }
    }

    // ---- instant_coins ----
    const use = await trx
      .insertInto('redeem_code_uses')
      .values({
        code_id:     codeRow.id,
        user_id:     userId,
        type:        codeRow.type,
        value:       codeRow.value,
        status:      'consumed',
        consumed_at: now,
      })
      .returning(['id'])
      .executeTakeFirstOrThrow()

    const coinsToCredit = BigInt(Math.round(Number(codeRow.value)))
    const newBalance = await creditCoins(trx, userId, coinsToCredit, use.id, `redeem_code:${use.id}`)

    await trx
      .updateTable('redeem_codes')
      .set({ used_count: sql`used_count + 1`, updated_at: now })
      .where('id', '=', codeRow.id)
      .execute()

    return {
      type:        'instant_coins' as const,
      coins:       Number(coinsToCredit),
      new_balance: String(newBalance),
    }
  })
}

// ---- ประวัติการใช้โค้ดของตัวเอง (สำหรับหน้า /purchase-history แท็บ "ประวัติการใช้โค้ด") ----
// join coin_ledger ผ่าน u.ledger_id แทนการใช้ u.value ตรงๆ — เพราะ value เป็น snapshot "ความหมาย
// ของโค้ด" (เช่น referral เก็บ % ค่าคอมมิชชั่นของเจ้าของโค้ด ไม่ใช่เหรียญที่ตัวเองได้ตอนสมัคร) ส่วน
// ledger_id ชี้ไปแถว coin_ledger ที่เครดิตเหรียญจริงให้ user นี้เสมอ (creditCoins() ตั้งให้ตอน
// instant_coins/referral แลกทันที, topup.service.ts ตั้งให้ทีหลังตอน topup_bonus_percent ถูกใช้
// จริงตอนเติมเงิน) — null = ยังไม่มีเหรียญเข้าจริง (เช่น topup_bonus_percent ที่ยัง pending)
export async function getMyRedeemHistory(userId: bigint, page: number, limit: number) {
  const offset = (page - 1) * limit

  const rows = await db
    .selectFrom('redeem_code_uses as u')
    .innerJoin('redeem_codes as c', 'c.id', 'u.code_id')
    .leftJoin('coin_ledger as l', 'l.id', 'u.ledger_id')
    .select(['u.id', 'u.type', 'u.value', 'u.status', 'u.expires_at', 'u.consumed_at', 'u.redeemed_at', 'c.code', 'l.delta as coins_credited'])
    .where('u.user_id', '=', userId)
    .orderBy('u.redeemed_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  const totalRow = await db
    .selectFrom('redeem_code_uses')
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .where('user_id', '=', userId)
    .executeTakeFirstOrThrow()

  const total = Number(totalRow.total)

  return {
    data: rows.map((r) => ({
      id:             String(r.id),
      code:           r.code,
      type:           r.type,
      value:          r.value,
      coins_credited: r.coins_credited === null ? null : String(r.coins_credited),
      status:         r.status,
      expires_at:     r.expires_at,
      consumed_at:    r.consumed_at,
      redeemed_at:    r.redeemed_at,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  }
}

// ---- โบนัสที่กำลังรอใช้อยู่ (สำหรับ highlight ปุ่ม "ใช้โค้ด" ในเนวบาร์) ----
export async function getActiveBonus(userId: bigint) {
  const row = await db
    .selectFrom('redeem_code_uses')
    .select(['value', 'expires_at'])
    .where('user_id', '=', userId)
    .where('status', '=', 'pending')
    .where('expires_at', '>', new Date())
    .orderBy('redeemed_at', 'desc')
    .executeTakeFirst()

  if (!row) return null

  return {
    percent:    Number(row.value),
    expires_at: row.expires_at,
  }
}
