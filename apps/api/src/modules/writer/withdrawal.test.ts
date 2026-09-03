// =============================================================
// withdrawal.test.ts — 2026-08-18, ใหม่
// =============================================================
// ครอบ requestWithdrawal() ใน writer.service.ts — จุดที่สองของ automated test suite (เงินไหลออก
// จากระบบจริง) รวมเทสของ guard ที่เพิ่งสร้างวันนี้ด้วย (PENDING_INFO_EDIT — ดู user.service.ts)

import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { db } from '../../db'
import { requestWithdrawal } from './writer.service'
import { submitWriterApplication } from '../user/user.service'
import { createTestUser, deleteTestUser, expectRejection } from '../../test-support/fixtures'

const APPLICATION_INPUT = {
  user_prefix: 'นาย',
  first_name: 'เทส',
  last_name: 'ถอนเงิน',
  user_phone: '0800000000',
  bank_name: 'ธนาคารกสิกรไทย',
}

describe('requestWithdrawal', () => {
  let writerId: bigint

  beforeAll(async () => {
    const writer = await createTestUser('withdraw_writer', { level: 6, sales: 50000n })
    writerId = writer.id
  })

  // ไม่เรียก db.destroy() ที่นี่ — ดู comment เดียวกันใน purchase.service.test.ts
  afterAll(async () => {
    await deleteTestUser(writerId)
  })

  test('ไม่มีบัญชีธนาคาร — โดนบล็อก NO_BANK_ACCOUNT', async () => {
    await expectRejection(requestWithdrawal(writerId, 1000), 'NO_BANK_ACCOUNT')
  })

  test('มีบัญชีธนาคารแล้ว ถอนสำเร็จ + snapshot บัญชีถูกต้อง', async () => {
    await db.updateTable('users').set({
      bank_code: 'kbank',
      bank_account_name: 'เทส ถอนเงิน',
      bank_account_number: '1112223334',
    }).where('id', '=', writerId).execute()

    const result = await requestWithdrawal(writerId, 1000)
    expect(result.status).toBe('pending')
    expect(result.account_number).toBe('1112223334')

    // เคลียร์คำขอนี้ก่อนเทสถัดไป (guard "1 pending ต่อครั้ง" ไม่ใช่จุดที่เทสนี้ต้องการ)
    await db.updateTable('withdrawals').set({ status: 'approved' }).where('id', '=', BigInt(result.id)).execute()
  })

  test('ยอดเกินยอดคงเหลือ — โดนบล็อก INSUFFICIENT_BALANCE', async () => {
    // sales=50000 * default withdrawal_rate 0.7 = ยอดคงเหลือ 35,000 — 40,000 ยังอยู่ในช่วงที่
    // อนุญาต (500-50,000/ครั้ง) แต่เกินยอดคงเหลือจริง ต่างจาก AMOUNT_OUT_OF_RANGE ที่เช็คแค่ range
    await expectRejection(requestWithdrawal(writerId, 40000), 'INSUFFICIENT_BALANCE')
  })

  test('มีคำขอถอนเงินค้างอยู่ — โดนบล็อก PENDING_WITHDRAWAL_EXISTS', async () => {
    const first = await requestWithdrawal(writerId, 500)
    try {
      await expectRejection(requestWithdrawal(writerId, 500), 'PENDING_WITHDRAWAL_EXISTS')
    } finally {
      await db.updateTable('withdrawals').set({ status: 'approved' }).where('id', '=', BigInt(first.id)).execute()
    }
  })

  test('มีการแก้ไขข้อมูลนักเขียนที่รอตรวจสอบ — โดนบล็อก PENDING_INFO_EDIT (migration 056)', async () => {
    await submitWriterApplication(writerId, 6, APPLICATION_INPUT)
    await expectRejection(requestWithdrawal(writerId, 500), 'PENDING_INFO_EDIT')
  })
})
