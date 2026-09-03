import Elysia from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { db } from '../db'
import { accountRateLimitRule, enforceRateLimit } from '../lib/rate-limit'

const AUTHENTICATED_READS_PER_ACCOUNT_PER_MINUTE = 600
const AUTHENTICATED_WRITES_PER_ACCOUNT_PER_MINUTE = 120

export const authMiddleware = new Elysia({ name: 'auth-middleware' })
  .use(jwt({
    name: 'jwt',
    secret: process.env.JWT_SECRET!,
  }))
  .derive({ as: 'scoped' }, async ({ jwt, headers, set }) => {
    const authorization = headers.authorization

    if (!authorization?.startsWith('Bearer ')) {
      set.status = 401
      throw new Error('กรุณาล็อกอินก่อน')
    }

    const token = authorization.slice(7)
    const payload = await jwt.verify(token)

    if (!payload) {
      set.status = 401
      throw new Error('Token ไม่ถูกต้องหรือหมดอายุ')
    }

    // "ระงับการเคลื่อนไหว" + "ลบบัญชีถาวร" (migration 027, 2026-07-30) — เช็คตรงนี้จุดเดียว
    // (choke point ของทุก route ที่ต้อง login) แทนที่จะไปเช็คแยกทีละ route ซึ่งพลาดจุดใดจุดหนึ่ง
    // ง่ายมาก ใช้ partial index (lifted_at IS NULL) ที่สร้างไว้แล้ว เร็วพอสำหรับเช็คทุก request
    // — แลกกับ query เพิ่ม 2 ครั้งต่อ request ที่ login อยู่
    //
    // ⚠️ เคสลบบัญชี: access token เดิม (อายุ 15 นาที) ยัง decode ผ่าน JWT verify ได้ตามปกติ (ไม่มี
    // token revocation list ในระบบนี้) ถ้าไม่เช็ค deleted_at ตรงนี้ด้วย บัญชีที่เพิ่งถูกลบจะยังยิง
    // request อื่นผ่านได้จนกว่า token จะหมดอายุเอง — เจอระหว่างทดสอบ permaDeleteUser แล้วแก้เพิ่ม
    const [activeSuspension, deletedUser] = await Promise.all([
      db
        .selectFrom('user_activity_suspensions')
        .select('id')
        .where('user_id', '=', BigInt(payload.sub as string))
        .where('lifted_at', 'is', null)
        .executeTakeFirst(),
      db
        .selectFrom('users')
        .select('id')
        .where('id', '=', BigInt(payload.sub as string))
        .where('deleted_at', 'is not', null)
        .executeTakeFirst(),
    ])

    if (activeSuspension) {
      set.status = 403
      throw new Error('บัญชีนี้ถูกระงับการใช้งานชั่วคราว')
    }
    if (deletedUser) {
      set.status = 401
      throw new Error('บัญชีนี้ถูกลบไปแล้ว')
    }

    return {
      user: {
        id: payload.sub as string,
        uuid: payload.uuid as string,
        level: Number(payload.level),
      }
    }
  })
  .onBeforeHandle(async ({ user, request, set }) => {
    const isRead = ['GET', 'HEAD', 'OPTIONS'].includes(request.method)
    // This is a broad safety net for every authenticated route. It fails open
    // during a Redis outage so ordinary reading is still available; expensive
    // or security-sensitive operations add their own fail-closed rule.
    return enforceRateLimit(set, [
      accountRateLimitRule(
        isRead ? 'authenticated-read' : 'authenticated-write',
        user.id,
        isRead
          ? AUTHENTICATED_READS_PER_ACCOUNT_PER_MINUTE
          : AUTHENTICATED_WRITES_PER_ACCOUNT_PER_MINUTE,
        60,
        'allow',
      ),
    ])
  })
