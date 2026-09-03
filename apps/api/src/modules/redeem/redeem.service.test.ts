// =============================================================
// redeem.service.test.ts — 2026-08-18, ใหม่
// =============================================================
// ครอบ redeemCode() — จุดที่สามของ automated test suite (เหรียญเข้าระบบจากโค้ด/ค่าคอมมิชชั่น
// ชวนเพื่อน) รวม referral self-redeem guard ที่แก้ไปเมื่อสร้างฟีเจอร์ชวนเพื่อนด้วย

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { db } from '../../db'
import { redeemCode } from './redeem.service'
import { getOrCreateMyReferralCode } from './referral.service'
import { createTestUser, deleteTestUser, createTestInstantCoinsCode, deleteTestRedeemCode, expectRejection } from '../../test-support/fixtures'

describe('redeemCode', () => {
  let userId: bigint
  let instantCode: string

  beforeAll(async () => {
    const user = await createTestUser('redeem_user', { point: 0n })
    userId = user.id
    instantCode = await createTestInstantCoinsCode(25)
  })

  // ไม่เรียก db.destroy() ที่นี่ — ดู comment เดียวกันใน purchase.service.test.ts
  afterAll(async () => {
    await deleteTestRedeemCode(instantCode)
    await deleteTestUser(userId)
  })

  test('แลกโค้ด instant_coins สำเร็จ — เหรียญเข้าถูกต้อง', async () => {
    const before = await db.selectFrom('users').select('point').where('id', '=', userId).executeTakeFirstOrThrow()
    const result = await redeemCode(userId, instantCode)

    expect(result.type).toBe('instant_coins')
    if (result.type === 'instant_coins') expect(result.coins).toBe(25)

    const after = await db.selectFrom('users').select('point').where('id', '=', userId).executeTakeFirstOrThrow()
    expect(Number(after.point) - Number(before.point)).toBe(25)
  })

  test('แลกโค้ดเดิมซ้ำ — โดนบล็อก ALREADY_REDEEMED', async () => {
    await expectRejection(redeemCode(userId, instantCode), 'ALREADY_REDEEMED')
  })

  test('โค้ดไม่มีอยู่จริง — โดนบล็อก CODE_NOT_FOUND', async () => {
    await expectRejection(redeemCode(userId, 'NOTAREALCODE99'), 'CODE_NOT_FOUND')
  })

  test('แลกโค้ดชวนเพื่อนของตัวเอง — โดนบล็อก CANNOT_REDEEM_OWN_CODE', async () => {
    const myReferral = await getOrCreateMyReferralCode(userId)
    await expectRejection(redeemCode(userId, myReferral.code), 'CANNOT_REDEEM_OWN_CODE')
  })
})
