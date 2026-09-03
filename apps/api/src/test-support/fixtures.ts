// =============================================================
// Novel Platform — Test Fixtures (2026-08-18, ใหม่)
// วางไว้ที่: apps/api/src/test-support/fixtures.ts
// =============================================================
//
// ใช้ร่วมกันทุกไฟล์ *.test.ts — ทดสอบแบบ integration จริงกับ DB dev (ไม่ mock) ตาม pattern
// เดียวกับ throwaway verify script ที่ใช้ตลอดทั้งโปรเจกต์นี้ (สร้าง user จริงผ่าน registerUser()
// เดียวกับที่ production ใช้ → รัน → ลบ) แค่เปลี่ยนจาก "เขียนสด รันครั้งเดียวแล้วลบไฟล์" เป็นไฟล์
// ถาวรที่รันซ้ำได้ทุกครั้งผ่าน `bun test` — u_name แต่ละ fixture ต้อง unique พอที่จะไม่ชนกับ
// ข้อมูล dev จริงหรือ fixture อื่น (prefix `_test_` + random suffix)

import { db } from '../db'
import { registerUser } from '../modules/auth/auth.service'

export function testUsername(prefix: string): string {
  return `_test_${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

export async function createTestUser(prefix: string, overrides: Partial<{
  level: number
  point: bigint
  sales: bigint
  bank_code: string
  bank_account_name: string
  bank_account_number: string
}> = {}) {
  const u_name = testUsername(prefix)
  const user = await registerUser({
    u_name,
    display_name: u_name,
    email: `${u_name}@example.com`,
    password: 'TestPass123!',
  })
  const id = BigInt(user.id)

  const { level, ...rest } = overrides
  if (level !== undefined || Object.keys(rest).length > 0) {
    await db.updateTable('users').set({ ...(level !== undefined ? { level } : {}), ...rest } as any).where('id', '=', id).execute()
  }

  return { id, uuid: user.uuid, u_name }
}

// ลบข้อมูลทดสอบทุกตารางที่ FK อ้างถึง users(id) เท่าที่ test ในไฟล์นี้อาจสร้างไว้ — ลำดับสำคัญ
// (ต้องลบตารางลูกก่อนตารางแม่เสมอ กัน FK violation)
export async function deleteTestUser(userId: bigint) {
  await db.deleteFrom('ep_shop').where('user_id', '=', userId).execute()
  await db.deleteFrom('coin_ledger').where('user_id', '=', userId).execute()
  await db.deleteFrom('withdrawals').where('user_id', '=', userId).execute()
  await db.deleteFrom('user_detail').where('user_id', '=', userId).execute()
  await db.deleteFrom('redeem_code_uses').where('user_id', '=', userId).execute()
  await db.deleteFrom('topup_transactions').where('user_id', '=', userId).execute()
  await db.deleteFrom('login_history').where('user_id', '=', userId).execute()

  // ลบโค้ดชวนเพื่อนของตัวเอง (ถ้ามี — getOrCreateMyReferralCode() อาจสร้างไว้ระหว่างเทส) ต้องลบ
  // redeem_code_uses ที่ผูกกับโค้ดนี้ก่อน (คนอื่นอาจเคยแลกโค้ดนี้ไปแล้วในเทสเดียวกัน)
  const ownCodes = await db.selectFrom('redeem_codes').select('id').where('created_by', '=', userId).execute()
  for (const c of ownCodes) {
    await db.deleteFrom('redeem_code_uses').where('code_id', '=', c.id).execute()
  }
  await db.deleteFrom('redeem_codes').where('created_by', '=', userId).execute()

  await db.deleteFrom('users').where('id', '=', userId).execute()
}

/** หา episode ที่ซื้อได้จริง (publish แล้ว, ไม่ฟรี, ไม่ใช่ของ excludeAuthorId) — คืน null ถ้าไม่มี
    (เช่น DB dev ว่างเปล่าตอน CI รันครั้งแรก — test ที่ใช้ fixture นี้ควร skip เองถ้าได้ null) */
export async function findPurchasableEpisode(excludeAuthorId: bigint) {
  const ep = await db
    .selectFrom('work_ep as ep')
    .innerJoin('works as c', 'c.p_id', 'ep.p_id')
    .select(['ep.ep_id', 'ep.ep_price', 'c.author_id'])
    .where('ep.status', '=', 'active')
    .where('ep.publish_status', '=', 'now')
    .where('ep.ep_price', '>', '0')
    .where('c.author_id', '!=', excludeAuthorId)
    .limit(1)
    .executeTakeFirst()

  return ep ?? null
}

/** หาโค้ด redeem ประเภท instant_coins ที่ใช้งานได้จริง — สร้างใหม่ทุกครั้ง (โค้ดทดสอบ ไม่ใช้ร่วมกับ
    ข้อมูลจริง) เพื่อไม่ให้ max_uses/max_uses_per_user ของโค้ดจริงกระทบผลทดสอบ */
export async function createTestInstantCoinsCode(value: number) {
  const code = testUsername('code').toUpperCase()
  await db
    .insertInto('redeem_codes')
    .values({
      code,
      type: 'instant_coins',
      value: String(value),
      status: 'active',
      bonus_window_hours: null,
      max_uses: null,
      max_uses_per_user: 1,
      used_count: 0,
      valid_from: null,
      valid_until: null,
      label: null,
      created_by: null,
    })
    .execute()
  return code
}

export async function deleteTestRedeemCode(code: string) {
  const row = await db.selectFrom('redeem_codes').select('id').where('code', '=', code).executeTakeFirst()
  if (!row) return
  await db.deleteFrom('redeem_code_uses').where('code_id', '=', row.id).execute()
  await db.deleteFrom('redeem_codes').where('id', '=', row.id).execute()
}

// ใช้แทน expect(promise).rejects.toThrow(msg) ของ bun:test ตรงๆ — เจอบั๊กจริงใน bun 1.3.13
// (ยืนยันแล้วด้วยการทดสอบแยก): matcher นั้น "ค้าง" จนครบ test timeout ทุกครั้งกับ promise ที่มาจาก
// async function ในโปรเจกต์นี้ แม้ promise เองจะ reject เร็วมาก (< 50ms วัดจริงนอก bun:test) —
// plain try/catch ธรรมดาไม่มีปัญหาเลย ใช้ helper นี้แทนทั้งหมดจนกว่า bun จะแก้บั๊กนี้
export async function expectRejection(promise: Promise<unknown>, expectedMessage: string) {
  try {
    await promise
  } catch (e: any) {
    if (e.message !== expectedMessage) {
      throw new Error(`expected rejection message "${expectedMessage}" but got "${e.message}"`)
    }
    return
  }
  throw new Error(`expected rejection with message "${expectedMessage}" but promise resolved`)
}
