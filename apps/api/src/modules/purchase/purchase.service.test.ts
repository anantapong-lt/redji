// =============================================================
// purchase.service.test.ts — 2026-08-18, ใหม่
// =============================================================
// integration test จริงกับ DB dev (ไม่ mock) — จุดแรกของ automated test suite ตามที่ user ขอ
// เริ่มจาก "จุดเงิน" ก่อน (purchase/withdraw/redeem) ดู KNOWN_ISSUES.md เดิมที่ flag ไว้ว่าไม่มี
// automated test เลยสักจุดสำหรับ flow เกี่ยวกับเงิน

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { db } from '../../db'
import { purchaseEpisodes } from './purchase.service'
import { createTestUser, deleteTestUser, findPurchasableEpisode, expectRejection } from '../../test-support/fixtures'

describe('purchaseEpisodes', () => {
  let buyerId: bigint
  let poorBuyerId: bigint
  let episode: Awaited<ReturnType<typeof findPurchasableEpisode>>
  let poorEpisode: Awaited<ReturnType<typeof findPurchasableEpisode>>

  // สร้าง fixture user ทั้งหมดที่นี่ (ไม่ใช่ในตัว test เอง) — registerUser() แฮชรหัสผ่านด้วย
  // argon2id (memoryCost 64MB โดยตั้งใจ กันเดารหัส) ต่อครั้งอาจกินเวลาหลักวินาที ถ้าสร้าง user
  // ในตัว test ที่มี timeout สั้นๆ (Bun default 5s) จะ time out ได้ง่ายๆ ทั้งที่ logic ไม่มีปัญหาเลย
  beforeAll(async () => {
    const buyer = await createTestUser('purchase_buyer', { point: 100000n })
    buyerId = buyer.id
    episode = await findPurchasableEpisode(buyerId)

    const poorBuyer = await createTestUser('purchase_poor', { point: 0n })
    poorBuyerId = poorBuyer.id
    poorEpisode = await findPurchasableEpisode(poorBuyerId)
  })

  // ไม่เรียก db.destroy() ที่นี่ — `db` เป็น singleton เดียวกันข้ามทุกไฟล์ *.test.ts เมื่อรันพร้อมกัน
  // ผ่าน `bun test` (โมดูลถูก cache ใช้ร่วมกันทั้ง process) เรียก destroy() ในไฟล์หนึ่งจะพังทุกไฟล์
  // ที่เหลือทันที ("driver has already been destroyed" — เจอบั๊กนี้จริงระหว่างเขียน) ปล่อยให้
  // process จบเองหลัง test ครบทุกไฟล์แทน (pg Pool idle timeout ปิด connection ให้เองภายในไม่กี่วิ)
  afterAll(async () => {
    await deleteTestUser(buyerId)
    await deleteTestUser(poorBuyerId)
  })

  test('ซื้อสำเร็จ — หักเหรียญถูกต้อง, สร้าง ep_shop + coin_ledger', async () => {
    if (!episode) return // DB dev ไม่มี episode ให้ซื้อได้ (เช่น environment ใหม่ล้วนๆ) — ข้าม

    const before = await db.selectFrom('users').select('point').where('id', '=', buyerId).executeTakeFirstOrThrow()

    const result = await purchaseEpisodes(buyerId, [episode.ep_id])

    const after = await db.selectFrom('users').select('point').where('id', '=', buyerId).executeTakeFirstOrThrow()
    const price = Math.round(Number(episode.ep_price))

    expect(Number(before.point) - Number(after.point)).toBe(price)
    expect(result.total_cost).toBe(price)

    const shopRow = await db
      .selectFrom('ep_shop')
      .select(['id', 'price', 'ledger_id'])
      .where('user_id', '=', buyerId)
      .where('ep_id', '=', episode.ep_id)
      .executeTakeFirstOrThrow()
    expect(shopRow.ledger_id).not.toBeNull()

    const ledgerRow = await db
      .selectFrom('coin_ledger')
      .select(['delta', 'reason'])
      .where('id', '=', shopRow.ledger_id!)
      .executeTakeFirstOrThrow()
    expect(Number(ledgerRow.delta)).toBe(-price)
    expect(ledgerRow.reason).toBe('purchase')
  })

  test('ซื้อตอนเดิมซ้ำ — โดนบล็อก ALREADY_PURCHASED', async () => {
    if (!episode) return

    await expectRejection(purchaseEpisodes(buyerId, [episode.ep_id]), 'ALREADY_PURCHASED')
  })

  test('เหรียญไม่พอ — โดนบล็อก INSUFFICIENT_COINS และไม่หักเหรียญเลย', async () => {
    if (!poorEpisode) return

    const before = await db.selectFrom('users').select('point').where('id', '=', poorBuyerId).executeTakeFirstOrThrow()
    await expectRejection(purchaseEpisodes(poorBuyerId, [poorEpisode.ep_id]), 'INSUFFICIENT_COINS')
    const after = await db.selectFrom('users').select('point').where('id', '=', poorBuyerId).executeTakeFirstOrThrow()

    expect(after.point).toBe(before.point)
  })

  test('ไม่ระบุตอนที่จะซื้อเลย — โดนบล็อก NO_EPISODES', async () => {
    await expectRejection(purchaseEpisodes(buyerId, []), 'NO_EPISODES')
  })
})
