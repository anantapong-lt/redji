// =============================================================
// Novel Platform — Topup Routes
// วางไว้ที่: apps/api/src/modules/topup/topup.routes.ts
// =============================================================

import Elysia, { t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { accountRateLimitRule, enforceRateLimit, ipRateLimitRule } from '../../lib/rate-limit'
import {
  getTopupPackages,
  initiateTopup,
  getTopupHistory,
  processTopupWebhook,
  mockConfirmTopup,
  getTopupStatus,
} from './topup.service'

export const topupRoutes = new Elysia({ prefix: '/topup' })

  // --------------------------------------------------
  // GET /topup/packages
  // รายการแพ็กเกจเติมเหรียญ (public — ไม่ต้อง login)
  // --------------------------------------------------
  .get('/packages', async () => {
    const data = await getTopupPackages()
    return { success: true, data }
  }, {
    detail: { summary: 'รายการแพ็กเกจเติมเหรียญ', tags: ['Topup'] },
  })

  // Routes ด้านล่างนี้ต้อง login — ใช้ .use(authMiddleware) แค่ส่วนที่เหลือ
  .use(authMiddleware)

  // --------------------------------------------------
  // POST /topup/initiate
  // เริ่มกระบวนการเติมเหรียญ
  // → สร้าง pending transaction และ ref_id
  // → frontend เอา ref_id ไปใช้กับ payment gateway
  // --------------------------------------------------
  .post('/initiate', async ({ user, body, set }) => {
    const limited = await enforceRateLimit(set, [
      accountRateLimitRule('topup-initiate', user.id, 5, 15 * 60),
    ])
    if (limited) return limited

    try {
      const data = await initiateTopup(
        BigInt(user.id),
        BigInt(body.package_id),
        body.payment_method,
      )
      set.status = 201
      return { success: true, data }
    } catch (err: any) {
      if (err.message === 'PACKAGE_NOT_FOUND') {
        set.status = 404
        return { success: false, message: 'ไม่พบแพ็กเกจนี้' }
      }
      if (err.message === 'SPEND_SUSPENDED') {
        set.status = 403
        return { success: false, message: 'บัญชีนี้ถูกระงับการใช้จ่ายและเติมเงินชั่วคราว' }
      }
      throw err
    }
  }, {
    body: t.Object({
      package_id:     t.Numeric(),
      payment_method: t.Union([t.Literal('promptpay'), t.Literal('truemoney')]),
    }),
    detail: { summary: 'เริ่มกระบวนการเติมเหรียญ', tags: ['Topup'] },
  })

  // --------------------------------------------------
  // GET /topup/status/:ref_id
  // เช็คสถานะ transaction เดียว — ให้ frontend poll รอผลหลัง initiate (แทน webhook ที่ยังไม่มี
  // gateway จริงมายิง ดู mock-confirm ด้านล่าง)
  // --------------------------------------------------
  .get('/status/:ref_id', async ({ user, params, set }) => {
    try {
      const data = await getTopupStatus(BigInt(user.id), params.ref_id)
      return { success: true, data }
    } catch (err: any) {
      if (err.message === 'TRANSACTION_NOT_FOUND') {
        set.status = 404
        return { success: false, message: 'ไม่พบรายการนี้' }
      }
      throw err
    }
  }, {
    params: t.Object({ ref_id: t.String() }),
    detail: { summary: 'เช็คสถานะการเติมเงิน (สำหรับ poll)', tags: ['Topup'] },
  })

  // --------------------------------------------------
  // POST /topup/mock-confirm/:ref_id
  //
  // ⚠️⚠️⚠️ MOCK ONLY — ห้ามมี endpoint นี้ใน production เด็ดขาด ⚠️⚠️⚠️
  // จำลองสิ่งที่ webhook จริงจาก payment gateway จะทำ (credit เหรียญ) แต่ไม่มีการตรวจสอบว่าจ่าย
  // เงินจริงหรือเปล่าเลย — แค่เช็คว่าเป็นเจ้าของ transaction เอง (ดู mockConfirmTopup() ใน
  // topup.service.ts) ถ้าเข้าถึงได้ใน production ใครก็เรียก endpoint นี้เพื่อได้เหรียญฟรีไม่
  // จำกัดจำนวนครั้งได้ทันที — บล็อกไว้ 2 ชั้น: (1) NODE_ENV check ตรงนี้ (2) ตอน integrate
  // payment gateway จริง ให้ลบ route นี้ทั้งก้อนทิ้งไปเลย (พร้อมฟังก์ชัน mockConfirmTopup() เอง)
  // --------------------------------------------------
  .post('/mock-confirm/:ref_id', async ({ user, params, set }) => {
    if (process.env.NODE_ENV === 'production') {
      set.status = 404
      return { success: false, message: 'Not found' }
    }
    try {
      const data = await mockConfirmTopup(BigInt(user.id), params.ref_id)
      return { success: true, data }
    } catch (err: any) {
      if (err.message === 'TRANSACTION_NOT_FOUND') {
        set.status = 404
        return { success: false, message: 'ไม่พบรายการนี้' }
      }
      if (err.message === 'NOT_YOUR_TRANSACTION') {
        set.status = 403
        return { success: false, message: 'ไม่ใช่รายการของคุณ' }
      }
      throw err
    }
  }, {
    params: t.Object({ ref_id: t.String() }),
    detail: { summary: '[MOCK ONLY] จำลองว่าจ่ายเงินสำเร็จ — ต้องลบก่อน deploy production จริง', tags: ['Topup'] },
  })

  // --------------------------------------------------
  // GET /topup/history
  // ประวัติการเติมเงิน
  // --------------------------------------------------
  .get('/history', async ({ user, query }) => {
    const data = await getTopupHistory(
      BigInt(user.id),
      query.page ?? 1,
      query.limit ?? 20,
      query.status,
    )
    return { success: true, ...data }
  }, {
    query: t.Object({
      page:   t.Optional(t.Numeric({ minimum: 1 })),
      limit:  t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
      status: t.Optional(t.Union([
        t.Literal('pending'), t.Literal('completed'), t.Literal('failed'), t.Literal('cancelled'),
      ])),
    }),
    detail: { summary: 'ประวัติการเติมเหรียญ (filter สถานะได้)', tags: ['Topup'] },
  })

// =============================================================
// Webhook Routes (แยกออกมา — ไม่ใช้ authMiddleware)
//
// ทำไมไม่ใช้ JWT auth?
//   เพราะ webhook มาจาก payment gateway โดยตรง
//   gateway ไม่มี JWT token ของ user
//   เราตรวจตัวตนด้วย HMAC-SHA256 signature แทน
// =============================================================

export const topupWebhookRoutes = new Elysia({ prefix: '/topup' })

  // --------------------------------------------------
  // POST /topup/webhook/:provider
  // รับ callback จาก payment gateway
  //
  // provider: 'promptpay' | 'truemoney' (หรือชื่อ gateway เช่น '2c2p', 'omise')
  //
  // ⚠️ ไม่มี body schema — เพราะต้องการ raw body สำหรับ HMAC verification
  //    ถ้ากำหนด body schema Elysia จะ parse ก่อน แล้ว raw bytes จะหายไป
  //
  // Header ที่ต้องส่งมา:
  //   x-webhook-signature: HMAC-SHA256(rawBody, WEBHOOK_SECRET) เป็น hex string
  //   (ชื่อ header อาจต่างกันตาม gateway — ต้อง map ให้ถูกตอน integrate จริง)
  // --------------------------------------------------
  .post('/webhook/:provider', async ({ params, headers, set, request }) => {
    // Signed callbacks are still public HTTP endpoints. Bound invalid-signature
    // floods before reading their raw body; a 503 lets a genuine gateway retry.
    const limited = await enforceRateLimit(set, [
      ipRateLimitRule('topup-webhook-ip', request, 120, 60),
    ])
    if (limited) return limited

    // อ่าน raw body ก่อน parse — สำคัญมากสำหรับ HMAC verification
    // ถ้าใช้ body ที่ Elysia parse แล้ว byte-for-byte ไม่ตรงกับต้นฉบับ → HMAC fail
    const rawBody = await request.text()

    // รองรับ header หลายชื่อของ gateway ต่างๆ
    const signature =
      headers['x-webhook-signature'] ??
      headers['x-2c2p-signature'] ??
      headers['x-omise-webhook-signature'] ??
      headers['x-gbprimepay-signature'] ??
      ''

    try {
      const result = await processTopupWebhook(params.provider, rawBody, signature)
      // คืน 200 เสมอ เพื่อบอก gateway ว่า "ได้รับแล้ว"
      // ถ้าคืน error gateway อาจ retry ซ้ำ → อาจ double-credit ได้
      return { success: true, ...result }
    } catch (err: any) {
      if (err.message === 'INVALID_SIGNATURE') {
        set.status = 401
        return { success: false, message: 'Invalid signature' }
      }
      if (err.message === 'TRANSACTION_NOT_FOUND') {
        // อาจเป็น webhook มาก่อน transaction สร้าง (race condition) → 404
        set.status = 404
        return { success: false, message: 'Transaction not found' }
      }
      throw err
    }
  }, {
    params: t.Object({ provider: t.String() }),
    detail: {
      summary: 'Webhook จาก payment gateway (HMAC verified)',
      tags: ['Topup'],
    },
  })
