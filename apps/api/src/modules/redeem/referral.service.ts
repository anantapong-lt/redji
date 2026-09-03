// =============================================================
// Novel Platform — Referral (ชวนเพื่อน) Service (2026-08-18, ใหม่)
// วางไว้ที่: apps/api/src/modules/redeem/referral.service.ts
// =============================================================
//
// user ทั่วไปสร้างโค้ดชวนเพื่อนของตัวเองได้ 1 โค้ด (auto-gen ตอนเข้าหน้า "ชวนเพื่อน" ครั้งแรก) —
// โค้ดนี้เป็นแค่แถวหนึ่งใน redeem_codes (type='referral') ใช้ระบบเดียวกับโค้ดอื่นๆ ทั้งหมด
// (แลกผ่าน redeemCode() ใน redeem.service.ts, ผลของการแลกดู comment ที่นั่น)
//
// ⚠️ สุ่มล้วน ไม่ผูกกับ u_name/display_name เลย (2026-08-18 มติแก้ — เดิมลองอิงจาก u_name ก่อน
// แต่ u_name ใช้ล็อกอินได้ตรงๆ พอเป็นโค้ดที่ตั้งใจแชร์กว้างๆ จะเท่ากับประกาศ username สำหรับ
// ล็อกอินไปด้วย ลองเปลี่ยนไปใช้ display_name แทนแล้ว แต่ชื่อไทยล้วนจะไม่เหลืออักขระ A-Z0-9 เลย
// (fallback เป็น 'USER' หมด ไม่ personalize จริง) แถมต้องมาคอยคิดว่าจะ regenerate ทุกครั้งที่คน
// เปลี่ยนชื่อไหม — สุ่มล้วนตัดปัญหาทั้งสองข้อเลย ไม่ต้องผูกกับข้อมูล user อะไรอีก)

import { db } from '../../db'
import { REFERRAL_SIGNUP_BONUS_COINS, REFERRAL_COMMISSION_PERCENT } from './redeem.service'

const REFERRAL_MAX_USES = 10 // จำกัด 10 คนต่อโค้ด ตามที่ user ระบุ

function toStr(val: bigint | null | undefined): string | null {
  return val === null || val === undefined ? null : String(val)
}

async function generateUniqueCode(): Promise<string> {
  // ตัด 0/O, 1/I/L ออกจาก charset กันอ่านสับสนเวลาพิมพ์โค้ดตาม
  const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const LENGTH = 8

  for (let attempt = 0; attempt < 20; attempt++) {
    let candidate = ''
    for (let i = 0; i < LENGTH; i++) {
      candidate += CHARS[Math.floor(Math.random() * CHARS.length)]
    }
    const existing = await db.selectFrom('redeem_codes').select('id').where('code', '=', candidate).executeTakeFirst()
    if (!existing) return candidate
  }

  // ไม่น่าเกิดขึ้นจริง (charset^length ใหญ่มาก โอกาสชน 20 รอบติดกันแทบเป็นไปไม่ได้) — กันไว้เฉยๆ
  throw new Error('COULD_NOT_GENERATE_CODE')
}

// ---- ดึงโค้ดของตัวเอง (สร้างให้อัตโนมัติถ้ายังไม่เคยมี) + สถิติ ----
export async function getOrCreateMyReferralCode(userId: bigint) {
  let codeRow = await db
    .selectFrom('redeem_codes')
    .selectAll()
    .where('type', '=', 'referral')
    .where('created_by', '=', userId)
    .executeTakeFirst()

  if (!codeRow) {
    const code = await generateUniqueCode()

    codeRow = await db
      .insertInto('redeem_codes')
      .values({
        code,
        type:              'referral',
        value:             String(REFERRAL_COMMISSION_PERCENT),
        max_uses:          REFERRAL_MAX_USES,
        max_uses_per_user: 1,
        used_count:        0,
        status:            'active',
        created_by:        userId,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  // เหรียญรวมที่เคยได้จากค่าคอมมิชชั่น (ไม่รวมเหรียญสมัครของเพื่อน — คนละ user_id บน ledger)
  const earnedRow = await db
    .selectFrom('coin_ledger as l')
    .innerJoin('redeem_code_uses as u', 'u.id', 'l.ref_id')
    .select(({ fn }) => fn.sum<string>('l.delta').as('total'))
    .where('l.user_id', '=', userId)
    .where('l.ref_type', '=', 'redeem_code_use')
    .where('u.code_id', '=', codeRow.id)
    .executeTakeFirst()

  return {
    code:              codeRow.code,
    percent:           Number(codeRow.value),
    signup_bonus_coins: REFERRAL_SIGNUP_BONUS_COINS,
    used_count:        codeRow.used_count,
    max_uses:          codeRow.max_uses,
    total_earned_coins: Number(earnedRow?.total ?? 0),
  }
}

// ---- รายชื่อเพื่อนที่แลกโค้ดของฉัน + เหรียญที่ได้จากแต่ละคน ----
export async function getMyReferrals(userId: bigint) {
  const codeRow = await db
    .selectFrom('redeem_codes')
    .select('id')
    .where('type', '=', 'referral')
    .where('created_by', '=', userId)
    .executeTakeFirst()

  if (!codeRow) return []

  const uses = await db
    .selectFrom('redeem_code_uses as u')
    .innerJoin('users as usr', 'usr.id', 'u.user_id')
    .select(['u.id', 'u.redeemed_at', 'usr.display_name', 'usr.u_name', 'usr.user_img'])
    .where('u.code_id', '=', codeRow.id)
    .orderBy('u.redeemed_at', 'desc')
    .execute()

  if (uses.length === 0) return []

  const useIds = uses.map((u) => u.id)
  const earnedRows = await db
    .selectFrom('coin_ledger')
    .select(({ fn }) => ['ref_id', fn.sum<string>('delta').as('total')])
    .where('user_id', '=', userId)
    .where('ref_type', '=', 'redeem_code_use')
    .where('ref_id', 'in', useIds)
    .groupBy('ref_id')
    .execute()

  const earnedByUseId = new Map(earnedRows.map((r) => [toStr(r.ref_id), Number(r.total)]))

  return uses.map((u) => ({
    id:           toStr(u.id)!,
    display_name: u.display_name,
    u_name:       u.u_name,
    user_img:     u.user_img,
    joined_at:    u.redeemed_at,
    earned_coins: earnedByUseId.get(toStr(u.id)!) ?? 0,
  }))
}
