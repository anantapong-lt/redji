// =============================================================
// Novel Platform — Topup Service
// วางไว้ที่: apps/api/src/modules/topup/topup.service.ts
// =============================================================
//
// Flow การเติมเหรียญ (ของจริง — ยังไม่ได้ integrate ตอนนี้ ดู MOCK ด้านล่าง):
//   1. User เลือก package → POST /topup/initiate
//      → สร้าง topup_transaction (status: pending) + คืน ref_id + qr_code_data
//   2. Frontend เจนภาพ QR จาก qr_code_data โชว์ให้ user สแกน
//   3. User จ่ายเงิน → gateway ส่ง webhook มาที่ POST /topup/webhook/:provider
//   4. เราตรวจ HMAC signature → credit เหรียญ + เขียน coin_ledger (completeTopupTransaction())
//
// ⚠️ MOCK MODE (2026-08-06 — ยังไม่ได้ต่อ gateway จริง ดูรายละเอียดที่ initiateTopup()):
//   qr_code_data ที่คืนตอน initiate เป็นสตริงจำลอง ไม่ใช่ QR จ่ายเงินได้จริง — ขั้นตอนที่ 3-4
//   ข้างบนแทนที่ด้วย POST /topup/mock-confirm/:ref_id (mockConfirmTopup(), บล็อกไว้ใน
//   production ที่ชั้น route) เรียก completeTopupTransaction() ตัวเดียวกับ webhook จริงใช้ —
//   ผลลัพธ์สุดท้าย (เหรียญเข้า/ledger/status) เหมือนกันเป๊ะไม่ว่าจะมาทางไหน
//
// ❗ Security Critical:
//   - ต้องตรวจ HMAC-SHA256 ทุกครั้งก่อน credit เหรียญ (เฉพาะทาง webhook จริง)
//   - ต้องเช็ค idempotency_key ก่อน เพื่อป้องกัน double-credit จาก webhook retry
//   - mock-confirm ต้องลบทิ้งก่อน deploy จริง (ดู route)
// =============================================================

import crypto from 'node:crypto'
import { db } from '../../db'
import { sql } from 'kysely'

// =============================================================
// Helper Functions
// =============================================================

// ---- สร้าง ref_id ภายใน ----
// format: TP{timestamp base36}{random 6 ตัว}
// เช่น: TPLPGXK4ABC1
function generateRefId(): string {
  const ts   = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `TP${ts}${rand}`
}

// ---- ตรวจ HMAC-SHA256 signature ----
// ทำไมต้องมี?
//   ป้องกันคนส่ง fake webhook มาปลอมว่าจ่ายเงินแล้ว แล้วได้เหรียญฟรี
// ทำยังไง?
//   payment gateway จะเซ็น payload ด้วย shared secret
//   เราคำนวณ HMAC ของ raw body เทียบกับที่ gateway ส่งมาใน header
//
// ⚠️ ใช้ timingSafeEqual เสมอ — ห้ามใช้ === เพราะเสี่ยง timing attack
function verifyHmac(rawBody: string, signature: string, secret: string): boolean {
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')

    // timingSafeEqual ป้องกัน attacker ใช้เวลา response เดาค่าที่ถูกต้อง
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex'),
    )
  } catch {
    // ถ้า signature มีความยาวไม่ตรงกัน timingSafeEqual จะ throw → return false
    return false
  }
}

// =============================================================
// Topup Package Functions
// =============================================================

// ---- ดูรายการแพ็กเกจเติมเหรียญ (public) ----
export async function getTopupPackages() {
  const rows = await db
    .selectFrom('topup_packages')
    .select(['id', 'coin_amount', 'bonus', 'price'])
    .where('status', '=', 'show')
    .orderBy('price', 'asc')
    .execute()

  return rows.map((r) => ({
    id:          String(r.id),
    coin_amount: String(r.coin_amount),
    bonus:       String(r.bonus),
    // ⚠️ บั๊กจริงที่เจอ (2026-08-06, ตอนต่อหน้า /topup): r.coin_amount/r.bonus type ประกาศเป็น
    // bigint ใน Kysely (TopupPackagesTable) แต่ driver `pg` คืน BIGINT column เป็น string จริงๆ
    // เสมอ (กัน precision loss) — `r.coin_amount + r.bonus` แบบเดิมเลยเป็น string concat ไม่ใช่
    // บวกเลข เช่น "500"+"10" ได้ "50010" ไม่ใช่ 510 — ต้อง Number() ก่อน + เสมอ
    total_coins: String(Number(r.coin_amount) + Number(r.bonus)),  // สะดวก frontend แสดงผล
    price:       r.price,
  }))
}

// =============================================================
// Initiate Topup
// =============================================================

// ---- สร้าง pending topup transaction ----
// คืน ref_id ให้ frontend ไปใช้กับ payment gateway
//
// ⚠️ NOTE สำหรับ production:
//   ตรงนี้ควร call payment gateway API เพื่อสร้าง QR code หรือ payment URL
//   แล้ว return qr_code / payment_url กลับไปด้วย
//   แต่ขึ้นอยู่กับ gateway ที่เลือกใช้ (2C2P, Omise, GB Prime Pay, ฯลฯ)
//   ตอนนี้ return แค่ ref_id ก่อน เพื่อให้ backend สมบูรณ์ก่อน integrate gateway
export async function initiateTopup(
  userId: bigint,
  packageId: bigint,
  paymentMethod: 'promptpay' | 'truemoney',
) {
  // "ระงับการใช้จ่ายและเติมเงิน" (migration 027, 2026-07-30) — เช็คก่อนสร้าง transaction เลย
  // กันเคสบอทปั่นเติมเงินหลังโดนตั้งค่านี้ไว้แล้ว
  const spendSuspended = await db
    .selectFrom('user_spend_suspensions')
    .select('id')
    .where('user_id', '=', userId)
    .where('lifted_at', 'is', null)
    .executeTakeFirst()

  if (spendSuspended) throw new Error('SPEND_SUSPENDED')

  // หาแพ็กเกจ + เช็คว่า active อยู่
  const pkg = await db
    .selectFrom('topup_packages')
    .select(['id', 'coin_amount', 'bonus', 'price'])
    .where('id', '=', packageId)
    .where('status', '=', 'show')
    .executeTakeFirst()

  if (!pkg) throw new Error('PACKAGE_NOT_FOUND')

  const refId = generateRefId()

  // ⚠️⚠️⚠️ บั๊กจริงที่เจอตอนต่อหน้า /topup (2026-08-06) — สำคัญมาก อ่านก่อนแก้โค้ดตรงนี้ ⚠️⚠️⚠️
  // pkg.coin_amount/pkg.bonus type ประกาศเป็น bigint ใน Kysely (TopupPackagesTable) แต่ driver
  // `pg` คืนค่า BIGINT column จริงๆ ใน runtime เป็น string เสมอ (กัน JS number precision loss —
  // พฤติกรรมมาตรฐานของ node-postgres ไม่ใช่บั๊กของ pg เอง) โค้ดเดิม `pkg.coin_amount + pkg.bonus`
  // เลยเป็น string concatenation ไม่ใช่การบวกเลข — ยืนยันด้วย script ตรงๆ แล้ว:
  // coin_amount="500", bonus="10" → "500"+"10" ได้ "50010" (ควรได้ 510) แม้แต่ bonus=0 ก็ผิด
  // เหมือนกัน ("50"+"0" ได้ "500" ไม่ใช่ 50) — เพราะ topup_transactions ไม่เคยมีแถวจริงมาก่อนเลย
  // (เพิ่งต่อหน้านี้เป็นครั้งแรก) บั๊กนี้เลยไม่เคยไป over-credit เหรียญให้ใครจริงๆ แต่ถ้าไม่แก้
  // ก่อน merge ผู้ใช้ที่เติมเงินครั้งแรกจะได้เหรียญเกินจริงทันที (บางเคสเกินเกือบ 100 เท่า) —
  // แก้ด้วย BigInt() ทั้งคู่ก่อนบวกเสมอ (ไม่ใช้ Number() เพราะค่านี้จะถูก insert ลงคอลัมน์ BIGINT
  // ตรงๆ ต่อ — BigInt คงความแม่นยำเป๊ะ ไม่มีความเสี่ยงเรื่อง float แม้ค่าจะใหญ่แค่ไหนก็ตาม)
  const totalCoins = BigInt(pkg.coin_amount) + BigInt(pkg.bonus)

  // สร้าง transaction ในสถานะ pending
  // transaction_id ใช้ refId ชั่วคราว จนกว่า gateway จะยืนยัน
  const txn = await db
    .insertInto('topup_transactions')
    .values({
      user_id:        userId,
      package_id:     packageId,
      transaction_id: refId,   // placeholder — จะถูก overwrite ตอน webhook มา
      ref_id:         refId,
      payment_method: paymentMethod,
      amount_paid:    pkg.price,
      coins_added:    totalCoins,
      status:         'pending',
    })
    .returning(['id', 'ref_id', 'amount_paid', 'coins_added', 'payment_method'])
    .executeTakeFirstOrThrow()

  // ⚠️⚠️⚠️ MOCK QR — ยังไม่ได้ต่อ payment gateway จริง (2026-08-06) ⚠️⚠️⚠️
  //
  // ของจริงควรเป็นยังไง: ตรงนี้ (หลัง insert transaction ข้างบน) ควรเรียก API ของ payment
  // gateway ที่เลือกใช้ (2C2P/Omise/GB Prime Pay ฯลฯ) ส่ง amount + refId ไปสร้างรายการชำระเงินฝั่ง
  // เขา แล้วเอาค่าที่ได้กลับมา — บาง gateway คืน QR payload เป็นสตริง (มาตรฐาน EMV/PromptPay QR)
  // ให้เราเจนภาพ QR เอง บาง gateway คืน URL รูปภาพ QR สำเร็จรูปมาให้เลย (ใช้ <img src=...> ตรงๆ
  // ไม่ต้องเจนเอง) ต้องดู doc ของ gateway ที่เลือกใช้จริงว่าเป็นแบบไหน
  //
  // ทำไมตอนนี้ทำแบบนี้: การขอใช้ payment gateway จริงต้องผ่านขั้นตอนสมัคร/อนุมัติ (KYC) ซึ่งใช้
  // เวลานาน (user เองก็ยืนยันแล้วว่า "วุ่นวาย") — mock ไว้ก่อนเพื่อให้สร้าง+ทดสอบ flow เติมเหรียญ
  // ทั้งหมดได้ตั้งแต่วันนี้ (เลือกแพ็กเกจ → โชว์ QR → รอยืนยัน → เหรียญเข้าจริง) โดยไม่ต้องรอ
  // gateway อนุมัติก่อน — ฝั่ง frontend เจนภาพ QR จากสตริง qr_code_data ตรงๆ (ดู lib qrcode)
  //
  // qr_code_data ด้านล่างนี้ "ไม่ใช่" PromptPay payload จริง (ไม่ได้ตาม format EMV QR มาตรฐานเลย
  // แม้แต่นิดเดียว — ตั้งใจไม่ทำให้เหมือนของจริงเพื่อกันสับสน/กันเข้าใจผิดว่าใช้จ่ายเงินได้จริง)
  // เป็นแค่สตริงจำลองไว้ให้ frontend เจนภาพ QR ขึ้นมาโชว์เฉยๆ — สแกนแล้วไม่มีเงินวิ่งไปไหนจริง
  // ยืนยันการจ่ายเงินจริงต้องผ่าน POST /topup/mock-confirm/:ref_id (ดู mockConfirmTopup() ด้านล่าง
  // ในไฟล์นี้ — endpoint ทดสอบ ไม่ใช่ของจริง ต้องลบตอน integrate gateway จริง) แทน webhook จริง
  //
  // พอ integrate gateway จริงแล้ว: แทนที่ qrCodeData บรรทัดเดียวด้านล่างนี้ด้วยผลลัพธ์จาก API call
  // ข้างบน ไม่ต้องแก้ schema/logic ส่วนอื่นในไฟล์นี้เลย (topup_transactions ไม่มีคอลัมน์เก็บ QR
  // เพราะไม่จำเป็นต้อง persist — เจนใหม่ได้ตลอดจาก ref_id+amount ถ้าต้องโชว์ซ้ำ)
  const qrCodeData = `MOCK-TOPUP|${refId}|${pkg.price}|${Date.now()}`

  return {
    transaction_id: String(txn.id),
    ref_id:         txn.ref_id,
    amount:         txn.amount_paid,   // จำนวนเงินที่ต้องจ่าย (บาท)
    coins:          String(txn.coins_added),
    payment_method: txn.payment_method,
    qr_code_data:   qrCodeData,
    is_mock:        true,   // frontend ใช้ตัดสินใจโชว์ badge "โหมดทดสอบ" + ปุ่มจำลองจ่ายเงิน
  }
}

// =============================================================
// Topup History
// =============================================================

export async function getTopupHistory(
  userId: bigint,
  page: number,
  limit: number,
  status?: 'pending' | 'completed' | 'failed' | 'cancelled',
) {
  const offset = (page - 1) * limit

  let query = db
    .selectFrom('topup_transactions as t')
    .leftJoin('topup_packages as p', 'p.id', 't.package_id')
    .where('t.user_id', '=', userId)

  if (status) query = query.where('t.status', '=', status)

  const rows = await query
    .select([
      't.id',
      't.ref_id',
      't.transaction_id',
      't.payment_method',
      't.amount_paid',
      't.coins_added',
      't.status',
      't.created_at',
      't.updated_at',
      'p.coin_amount',
      'p.bonus',
    ])
    .orderBy('t.created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  let countQuery = db.selectFrom('topup_transactions').where('user_id', '=', userId)
  if (status) countQuery = countQuery.where('status', '=', status)
  const countRow = await countQuery
    .select(({ fn }) => fn.countAll<string>().as('total'))
    .executeTakeFirstOrThrow()

  const total = Number(countRow.total)

  return {
    data: rows.map((r) => ({
      id:             String(r.id),
      ref_id:         r.ref_id,
      transaction_id: r.transaction_id,
      payment_method: r.payment_method,
      amount_paid:    r.amount_paid,
      coins_added:    String(r.coins_added),
      status:         r.status,
      created_at:     r.created_at,
      updated_at:     r.updated_at,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  }
}

// =============================================================
// Webhook Processing
// =============================================================

// ---- Process webhook จาก payment gateway ----
//
// rawBody  = raw string ก่อน JSON.parse (สำคัญมาก! ใช้คำนวณ HMAC)
// provider = 'promptpay' | 'truemoney' (มาจาก URL param)
// signature = ค่าจาก HTTP header ที่ gateway ส่งมา
//
// ⚠️ Payload format ต่างกันตาม gateway:
//   ตอน integrate gateway จริง ให้ map field เหล่านี้ให้ถูก:
//   - refId       : ref ของเราที่ส่งไปตอน initiate (gateway จะ echo กลับ)
//   - gatewayTxnId: transaction ID ของ gateway เอง
//   - statusRaw   : status string จาก gateway (success/fail)
//
//   ตัวอย่าง field ของแต่ละ gateway:
//     2C2P      → payload.referenceNo, payload.tranRef, payload.respCode ('0000'=success)
//     Omise     → payload.data.metadata.ref_id, payload.data.id, payload.key ('charge.complete')
//     GB Prime  → payload.referenceNo, payload.gbpReferenceNo, payload.resultCode ('00'=success)
export async function processTopupWebhook(
  provider: string,
  rawBody: string,
  signature: string,
) {
  // 1. ตรวจ HMAC — ต้องทำก่อนทุกอย่าง ถ้า fail = reject ทันที
  const secret = process.env.WEBHOOK_SECRET!
  if (!verifyHmac(rawBody, signature, secret)) {
    throw new Error('INVALID_SIGNATURE')
  }

  // 2. Parse body
  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    throw new Error('INVALID_PAYLOAD')
  }

  // 3. ดึง field จาก payload — ปรับ field names ตาม gateway จริง
  //    ตอนนี้รองรับ format กลางๆ + fallback หลายชื่อ
  const refId: string =
    payload.ref_id ??
    payload.referenceNo ??
    payload.merchant_ref ??
    payload.metadata?.ref_id

  const gatewayTxnId: string =
    payload.transaction_id ??
    payload.tranRef ??
    payload.gbpReferenceNo ??
    payload.data?.id ??
    refId  // fallback ถ้าไม่มี gateway txn id

  const statusRaw: string =
    payload.status ??
    payload.respCode ??
    payload.resultCode ??
    payload.key ??
    'unknown'

  if (!refId) throw new Error('MISSING_REF_ID')

  // 4. หา transaction ในระบบจาก ref_id
  const topupTxn = await db
    .selectFrom('topup_transactions')
    .select(['id', 'user_id', 'coins_added', 'status'])
    .where('ref_id', '=', refId)
    .executeTakeFirst()

  if (!topupTxn) throw new Error('TRANSACTION_NOT_FOUND')

  // 5. ถ้า complete ไปแล้ว → webhook retry → ตอบ OK ไปเฉยๆ (idempotent)
  //    gateway มักส่ง webhook ซ้ำหลายรอบ เราต้องทนทานต่อสิ่งนี้
  if (topupTxn.status === 'completed') {
    return { already_processed: true }
  }

  // 6. เช็ค status จาก gateway ว่าจ่ายสำเร็จจริง
  //    แต่ละ gateway ใช้ code ต่างกัน — รวมไว้ทั้งหมดที่รู้จัก
  const SUCCESS_CODES = ['success', 'SUCCESS', 'completed', 'COMPLETED', '00', '0000', 'charge.complete']
  const isSuccess = SUCCESS_CODES.includes(statusRaw)

  if (!isSuccess) {
    // จ่ายไม่สำเร็จ → update status เป็น failed + เก็บ payload ไว้ debug
    await db
      .updateTable('topup_transactions')
      .set({
        status:      'failed',
        raw_webhook: payload,
        updated_at:  new Date(),
      })
      .where('id', '=', topupTxn.id)
      .execute()

    return { processed: true, credited: false }
  }

  // 7-8. เพิ่มเหรียญ + เขียน ledger + mark completed — ก้อนนี้แยกออกไปเป็น
  // completeTopupTransaction() ด้านล่าง เพราะโค้ด mock-confirm (ดู mockConfirmTopup()) ต้องใช้
  // logic เดียวกันเป๊ะ ไม่อยากให้ 2 จุด credit เหรียญด้วยคนละ logic กัน (เสี่ยงหลุด idempotency
  // check ถ้าแก้จุดเดียวแล้วลืมอีกจุด)
  const result = await completeTopupTransaction(refId, gatewayTxnId, payload)
  return { processed: true, ...result }
}

// =============================================================
// Complete Topup (ใช้ร่วมกันทั้ง webhook จริงและ mock-confirm)
// =============================================================
//
// เพิ่มเหรียญ + เขียน coin_ledger + mark topup_transactions เป็น completed — เป็น "จุดเดียว" ที่
// เหรียญจากการเติมเงินจะถูกสร้างขึ้นจริงในระบบ ไม่ว่าจะมาจาก webhook จริง (processTopupWebhook)
// หรือ mock-confirm (mockConfirmTopup, ดู comment อธิบายที่ initiateTopup() ด้านบน) — เช็ค
// idempotency ซ้ำเองข้างในเสมอ (ไม่พึ่ง caller เช็คมาให้) กันเคส race condition ที่ 2 ทางเรียก
// ชนกันพอดี
async function completeTopupTransaction(refId: string, gatewayTxnId: string, rawPayload: unknown) {
  const topupTxn = await db
    .selectFrom('topup_transactions')
    .select(['id', 'user_id', 'coins_added', 'status'])
    .where('ref_id', '=', refId)
    .executeTakeFirst()

  if (!topupTxn) throw new Error('TRANSACTION_NOT_FOUND')
  if (topupTxn.status === 'completed') return { already_processed: true }

  // เช็ค idempotency ใน coin_ledger ก่อน credit — ถ้า key นี้มีอยู่แล้ว แปลว่า credit ไปแล้ว
  const idempotencyKey = `topup:${String(topupTxn.id)}`
  const existingEntry = await db
    .selectFrom('coin_ledger')
    .select('id')
    .where('idempotency_key', '=', idempotencyKey)
    .executeTakeFirst()

  if (existingEntry) return { already_processed: true }

  let newBalance: bigint = 0n

  // DB Transaction: เพิ่มเหรียญ + เขียน ledger + update topup status — ทำใน transaction เดียว
  // ถ้าขั้นตอนใดล้มเหลว ทั้งหมด rollback
  await db.transaction().execute(async (trx) => {
    const updatedUser = await trx
      .updateTable('users')
      .set({
        // point is intentionally write-protected in DB types. This is an
        // atomic SQL increment, consistent with purchase/referral updates.
        point: sql<bigint>`point + ${topupTxn.coins_added}` as any,
      })
      .where('id', '=', topupTxn.user_id)
      .returning('point')
      .executeTakeFirstOrThrow()

    newBalance = updatedUser.point

    // เขียน coin_ledger (append-only — ห้าม UPDATE/DELETE)
    await trx
      .insertInto('coin_ledger')
      .values({
        user_id:         topupTxn.user_id,
        delta:           topupTxn.coins_added,       // + = ได้รับเหรียญ
        reason:          'topup',
        ref_type:        'topup_transaction',
        ref_id:          topupTxn.id,
        idempotency_key: idempotencyKey,
        balance_after:   newBalance,
      })
      .execute()

    // อัปเดต topup_transaction → completed + บันทึก gateway txn id + raw payload
    await trx
      .updateTable('topup_transactions')
      .set({
        status:          'completed',
        transaction_id:  gatewayTxnId,
        idempotency_key: idempotencyKey,
        raw_webhook:     rawPayload as any,
        updated_at:      new Date(),
      })
      .where('id', '=', topupTxn.id)
      .execute()

    // ---- โบนัส % จากการแลกโค้ด (migration 052, redeem_code_uses.status='pending') ----
    // FOR UPDATE ล็อกแถว pending ไว้ก่อน กันเคส user มี topup 2 รายการค้างพร้อมกันแล้วโบนัสถูก
    // ใช้ซ้ำ 2 รอบ (transaction ที่ถึงก่อนจะล็อกได้ อีกอันต้องรอจนกว่า transaction แรก commit แล้ว
    // status เปลี่ยนเป็น consumed ไปแล้ว — SELECT WHERE status='pending' ของรอบหลังจะไม่เจอแถวนี้อีก)
    const bonusUse = await trx
      .selectFrom('redeem_code_uses')
      .selectAll()
      .where('user_id', '=', topupTxn.user_id)
      .where('status', '=', 'pending')
      .where('expires_at', '>', new Date())
      .orderBy('redeemed_at', 'desc')
      .forUpdate()
      .executeTakeFirst()

    let bonusCoins = 0n
    if (bonusUse) {
      bonusCoins = BigInt(Math.floor(Number(topupTxn.coins_added) * (Number(bonusUse.value) / 100)))

      if (bonusCoins > 0n) {
        const bonusUpdatedUser = await trx
          .updateTable('users')
          .set({ point: sql<bigint>`point + ${bonusCoins}` as any }) // point เป็น ColumnType<bigint, never, never> (readonly ใน types.ts) — as any จำเป็น เหมือน purchase.service.ts
          .where('id', '=', topupTxn.user_id)
          .returning('point')
          .executeTakeFirstOrThrow()

        newBalance = bonusUpdatedUser.point // รวมโบนัสแล้ว — ให้ return ค่าสุดท้ายถูกต้อง

        const bonusLedgerRow = await trx
          .insertInto('coin_ledger')
          .values({
            user_id:         topupTxn.user_id,
            delta:           bonusCoins,
            reason:          'redeem_code',
            ref_type:        'redeem_code_use',
            ref_id:          bonusUse.id,
            idempotency_key: `redeem_code_bonus:${bonusUse.id}`,
            balance_after:   newBalance,
          })
          .returning(['id'])
          .executeTakeFirstOrThrow()

        await trx
          .updateTable('redeem_code_uses')
          .set({
            status:            'consumed',
            consumed_at:       new Date(),
            consumed_topup_id: topupTxn.id,
            ledger_id:         bonusLedgerRow.id,
          })
          .where('id', '=', bonusUse.id)
          .execute()
      }
    }

    // ---- ค่าคอมมิชชั่นชวนเพื่อน (migration 053, redeem_code_uses.status='active') ----
    // ต่างจากโบนัส % ด้านบน — ความสัมพันธ์นี้ถาวร ไม่มีวันเปลี่ยนสถานะ เช็คได้ทุกครั้งที่ user คนนี้
    // เติมเงิน (ไม่ใช่แค่ครั้งแรก) ไม่ต้องล็อกแถวนี้เพราะไม่ได้แก้ไขอะไรในนั้นเลย (แค่อ่าน referrer
    // จาก redeem_codes.created_by) — กัน double-credit ด้วย idempotency_key ที่ผูกกับ topup นี้
    // โดยเฉพาะ (referral:${referralUse.id}:${topupTxn.id}) ต่างจากโบนัสที่ผูกแค่ ${bonusUse.id}
    // เพราะโบนัสใช้ครั้งเดียวพอ แต่ referral ต้อง credit ซ้ำได้ทุก topup
    const referralUse = await trx
      .selectFrom('redeem_code_uses as u')
      .innerJoin('redeem_codes as c', 'c.id', 'u.code_id')
      .select(['u.id', 'c.created_by', 'c.value'])
      .where('u.user_id', '=', topupTxn.user_id)
      .where('u.type', '=', 'referral')
      .where('u.status', '=', 'active')
      .executeTakeFirst()

    if (referralUse && referralUse.created_by) {
      const commissionCoins = BigInt(Math.floor(Number(topupTxn.coins_added) * (Number(referralUse.value) / 100)))

      if (commissionCoins > 0n) {
        const referrerId = referralUse.created_by
        const referralIdempotencyKey = `redeem_code_referral:${referralUse.id}:${topupTxn.id}`

        const referrerUpdated = await trx
          .updateTable('users')
          .set({ point: sql<bigint>`point + ${commissionCoins}` as any }) // point เป็น ColumnType<bigint, never, never> (readonly ใน types.ts) — as any จำเป็น เหมือน purchase.service.ts
          .where('id', '=', referrerId)
          .returning('point')
          .executeTakeFirstOrThrow()

        await trx
          .insertInto('coin_ledger')
          .values({
            user_id:         referrerId,
            delta:           commissionCoins,
            reason:          'redeem_code',
            ref_type:        'redeem_code_use',
            ref_id:          referralUse.id,
            idempotency_key: referralIdempotencyKey,
            balance_after:   referrerUpdated.point,
          })
          .execute()
      }
    }
  })

  return {
    credited:    true,
    coins_added: String(topupTxn.coins_added),
    new_balance: String(newBalance),
  }
}

// =============================================================
// [MOCK ONLY] Simulate Payment Confirmation
// =============================================================
//
// ⚠️⚠️⚠️ ฟังก์ชันนี้ห้ามมีใน production เด็ดขาด — ดู route ที่เรียกใช้ (POST
// /topup/mock-confirm/:ref_id ใน topup.routes.ts) ที่บล็อกไว้ด้วย NODE_ENV check อีกชั้นแล้ว
// แต่ตัวฟังก์ชันเองก็ไม่ควรถูกเรียกจากที่ไหนอื่นนอกจาก route นั้นเลย
//
// ทำหน้าที่แทน payment gateway จริง — ปกติ gateway จะเป็นคนยิง webhook มายืนยันว่าจ่ายเงินสำเร็จ
// (ผ่าน processTopupWebhook() ด้านบน พร้อม HMAC signature พิสูจน์ตัวตนว่าเป็น gateway จริง) แต่
// ตอนนี้ยังไม่ได้ integrate gateway จริง (รอขั้นตอนสมัคร/อนุมัติ KYC ซึ่งใช้เวลานาน) เลยทำฟังก์ชันนี้
// ไว้ "แกล้งเป็น gateway" ชั่วคราว เพื่อให้ทดสอบ flow เติมเหรียญทั้งหมดได้ตั้งแต่วันนี้
//
// ต่างจาก webhook จริงตรงไหน: ไม่มีการตรวจสอบว่าจ่ายเงินจริงเลยสักนิด (ไม่มี HMAC, ไม่มี gateway
// เรียกมา) เช็คแค่ว่า user ที่เรียกเป็นเจ้าของ transaction นั้นจริง (กันคนอื่นเดา ref_id คนอื่นมา
// โกงเหรียญฟรี) แล้ว credit เหรียญทันทีผ่าน completeTopupTransaction() ตัวเดียวกับที่ webhook จริงใช้
//
// พอ integrate payment gateway จริงแล้ว: ลบฟังก์ชันนี้ + route ที่เรียกทิ้งได้เลย ไม่กระทบส่วนอื่น
// เพราะ completeTopupTransaction() (จุดเดียวที่ credit เหรียญจริง) ไม่ได้ผูกกับฟังก์ชันนี้เลย
export async function mockConfirmTopup(userId: bigint, refId: string) {
  const topupTxn = await db
    .selectFrom('topup_transactions')
    .select(['id', 'user_id'])
    .where('ref_id', '=', refId)
    .executeTakeFirst()

  if (!topupTxn) throw new Error('TRANSACTION_NOT_FOUND')
  if (BigInt(topupTxn.user_id) !== userId) throw new Error('NOT_YOUR_TRANSACTION')

  const mockGatewayTxnId = `MOCK-${crypto.randomUUID()}`
  return completeTopupTransaction(refId, mockGatewayTxnId, {
    mock:        true,
    confirmed_by: String(userId),
    confirmed_at: new Date().toISOString(),
  })
}

// =============================================================
// Topup Status (สำหรับ frontend poll รอผลหลัง initiate)
// =============================================================

export async function getTopupStatus(userId: bigint, refId: string) {
  const txn = await db
    .selectFrom('topup_transactions')
    .select(['status', 'coins_added'])
    .where('ref_id', '=', refId)
    .where('user_id', '=', userId)
    .executeTakeFirst()

  if (!txn) throw new Error('TRANSACTION_NOT_FOUND')

  const user = await db
    .selectFrom('users')
    .select('point')
    .where('id', '=', userId)
    .executeTakeFirstOrThrow()

  return {
    status:       txn.status,
    coins_added:  String(txn.coins_added),
    point:        String(user.point),
  }
}
