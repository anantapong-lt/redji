import Elysia, { t } from 'elysia'
import { jwt } from '@elysiajs/jwt'
import { authMiddleware } from '../../middleware/auth.middleware'
import { registerSchema, loginSchema } from './auth.schema'
import { registerUser, loginUser, forgotPassword, resetPassword, changePassword, getUserById, recordLoginHistory } from './auth.service'
import {
  accountRateLimitRule,
  enforceRateLimit,
  ipRateLimitRule,
  valueRateLimitRule,
} from '../../lib/rate-limit'

// ระยะเวลาที่ผู้ใช้เลือก "จดจำการเข้าสู่ระบบ" ของเว็บหลัก
// access token ยังคงสั้น 15 นาทีและต้อง refresh เสมอ — ที่ขยายคืออายุของ
// httpOnly refresh session ไม่ใช่อายุ bearer token โดยตรง
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30 // 30 วัน (วินาที)

const FIFTEEN_MINUTES = 15 * 60
const ONE_HOUR = 60 * 60

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET!,
      exp: '15m',
    })
  )
  // 2026-07-30 เจอบั๊ก: refresh token เดิม sign ผ่าน plugin ชื่อ 'jwt' ตัวเดียวกับ access token
  // ไม่ได้ override `exp` ต่อครั้ง เลย inherit ค่า default '15m' ของ plugin ไปด้วย (ทั้งที่คุกกี้
  // ที่ห่อ token นี้ตั้ง maxAge ไว้ 30 วันถูกต้องแล้ว — แค่ตัว JWT ข้างในหมดอายุก่อนคุกกี้เยอะมาก)
  // ผลคือถ้าห่างจาก login เกิน ~15 นาที (ปกติมากเวลาพัฒนา เช่น restart dev server แล้วกลับมา
  // ทำงานต่อ) ทั้ง access token และ refresh token หมดอายุพร้อมกัน — refresh ไม่ได้เลย ต้อง
  // login ใหม่ทุกครั้ง (JWT_REFRESH_SECRET ใน .env ก็มีอยู่แล้วแต่ไม่เคยถูกใช้จริงสักที่ — เพิ่ม
  // plugin แยกชื่อ 'refreshJwt' ใช้ secret คนละตัวกับ access token ไปเลย (แยกกันตามหลัก
  // security ทั่วไป ถ้า secret ตัวใดตัวหนึ่งหลุดจะกระทบแค่ token ประเภทเดียว) +ตั้ง exp ให้ตรง
  // กับคุกกี้จริง (30 วัน)
  .use(
    jwt({
      name: 'refreshJwt',
      secret: process.env.JWT_REFRESH_SECRET!,
      exp: '30d',
    })
  )
  .post(
    '/register',
    async ({ body, request, set }) => {
      const limited = await enforceRateLimit(set, [
        ipRateLimitRule('auth-register-ip', request, 5, ONE_HOUR),
      ])
      if (limited) return limited

      try {
        const user = await registerUser(body)
        set.status = 201
        return { success: true, user }
      } catch (err: any) {
        if (err.message === 'EMAIL_TAKEN') {
          set.status = 409
          return { success: false, message: 'อีเมลนี้ถูกใช้แล้ว' }
        }
        if (err.message === 'USERNAME_TAKEN') {
          set.status = 409
          return { success: false, message: 'Username นี้ถูกใช้แล้ว' }
        }
        throw err
      }
    },
    { body: registerSchema }
  )
  .post(
    '/login',
    async ({ body, set, jwt, refreshJwt, cookie: { refresh_token }, request }) => {
      const limited = await enforceRateLimit(set, [
        ipRateLimitRule('auth-login-ip', request, 30, FIFTEEN_MINUTES),
        valueRateLimitRule('auth-login-identifier', body.login, 10, FIFTEEN_MINUTES),
      ])
      if (limited) return limited

      // ดึง IP/user-agent ไว้บันทึก login_history (migration 026) — x-forwarded-for
      // ใช้ได้จริงตอน deploy หลัง reverse proxy/CDN (Cloudflare ฯลฯ) ส่วน dev local เฉยๆ
      // จะได้ null ไปเลย (ไม่มี proxy ไหนตั้ง header นี้ให้) ถือว่าปกติ
      const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        ?? request.headers.get('x-real-ip')
        ?? null
      const userAgent = request.headers.get('user-agent') ?? null

      try {
        const user = await loginUser(body)

        // แค่ log เสริม ห้ามพัง login จริงถ้าเขียนไม่สำเร็จ
        recordLoginHistory({
          userId: BigInt(user.id),
          identifier: body.login,
          success: true,
          ipAddress,
          userAgent,
        }).catch((err) => console.error('[login_history] บันทึกไม่สำเร็จ:', err))

        // Access token — หมดอายุ 15 นาที ส่งกลับใน response body
        const accessToken = await jwt.sign({
          sub: String(user.id),
          uuid: user.uuid,
          level: user.level,
        })

        // Refresh token — หมดอายุ 30 วันจริงแล้ว (ก่อนหน้านี้ inherit '15m' จาก plugin ผิด
        // ตัว — ดู comment ด้านบนสุดของไฟล์) เก็บใน httpOnly cookie
        // httpOnly = JS ฝั่ง client อ่านไม่ได้เลย ป้องกัน XSS
        const refreshToken = await refreshJwt.sign({
          sub: String(user.id),
          type: 'refresh',
        })

        refresh_token.set({
          value: refreshToken,
          httpOnly: true,
          // production: web/api อยู่คนละ subdomain กันจริง (Railway) — ต้อง
          // SameSite=None ถึงจะแนบ cookie นี้ไปกับ cross-site fetch ได้เลย
          // (Lax บล็อกไว้ ใช้งานได้แค่ตอน local dev ที่ web/api เป็น localhost
          // เหมือนกันหมด ถือเป็น same-site) None ต้องคู่กับ Secure เสมอ
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
          maxAge: REFRESH_TOKEN_MAX_AGE,
          path: '/',
        })

        return {
          success: true,
          access_token: accessToken,
          user: {
            id: user.id,
            uuid: user.uuid,
            u_name: user.u_name,
            display_name: user.display_name,
            email: user.email,
            level: user.level,
            point: Number(user.point),
            sales: Number(user.sales),
            user_img: user.user_img,
            writer_tier: user.writer_tier,
            auto_ep_purchase: user.auto_ep_purchase,
            load_all_images: user.load_all_images,
            created_at: user.created_at,
          },
        }
      } catch (err: any) {
        if (err.message === 'INVALID_CREDENTIALS') {
          recordLoginHistory({
            userId: null,
            identifier: body.login,
            success: false,
            ipAddress,
            userAgent,
          }).catch((logErr) => console.error('[login_history] บันทึกไม่สำเร็จ:', logErr))

          set.status = 401
          return { success: false, message: 'ชื่อบัญชีผู้ใช้งาน อีเมล หรือรหัสผ่านไม่ถูกต้อง' }
        }
        throw err
      }
    },
    { body: loginSchema }
  )
  .post('/logout', ({ cookie: { refresh_token }, set }) => {
    refresh_token.remove()
    set.status = 204
  })
  .post('/refresh', async ({ jwt, refreshJwt, cookie: { refresh_token }, request, set }) => {
    const limited = await enforceRateLimit(set, [
      ipRateLimitRule('auth-refresh-ip', request, 60, 60),
    ])
    if (limited) return limited

    const token = String(refresh_token.value ?? '')
    if (!token) {
      set.status = 401
      return { success: false, message: 'ไม่พบ refresh token' }
    }

    const payload = await refreshJwt.verify(token)
    if (!payload || payload.type !== 'refresh') {
      set.status = 401
      return { success: false, message: 'Refresh token ไม่ถูกต้องหรือหมดอายุ' }
    }

    // ⚠️ เดิมอ่าน payload.uuid/payload.level ตรงๆ แต่ refresh token ไม่เคยมี field พวกนี้เลย
    // ตั้งแต่แรก (sign แค่ sub/type ด้านบน) — ได้ undefined ทุกครั้ง ทำให้ access token ใหม่หลัง
    // refresh ทุกครั้งไม่มี uuid + level เป็น NaN (พังทุก route ที่เช็ค level/ใช้ uuid) — ดึงจาก
    // DB สดใหม่แทน (เหมือน GET /auth/me) ได้ประโยชน์เพิ่มคือ level ล่าสุดจริง (เช่นเพิ่งได้รับ
    // อนุมัติเป็นนักเขียนหลัง login ไว้นานแล้ว ไม่ต้อง logout/login ใหม่ก็เห็นสิทธิ์ใหม่ทันที)
    let dbUser
    try {
      dbUser = await getUserById(payload.sub as string)
    } catch {
      set.status = 401
      return { success: false, message: 'ไม่พบผู้ใช้งาน' }
    }

    const newAccessToken = await jwt.sign({
      sub: String(dbUser.id),
      uuid: dbUser.uuid,
      level: dbUser.level,
    })

    return { success: true, access_token: newAccessToken }
  })
  .post(
    '/forgot-password',
    async ({ body, request, set }) => {
      const limited = await enforceRateLimit(set, [
        ipRateLimitRule('auth-forgot-password-ip', request, 5, ONE_HOUR),
        valueRateLimitRule('auth-forgot-password-email', body.email, 3, ONE_HOUR),
      ])
      if (limited) return limited

      await forgotPassword(body.email)
      // return เหมือนกันทั้ง เจอและไม่เจอ email — ป้องกัน user enumeration
      return { success: true, message: 'ถ้ามีบัญชีนี้อยู่ระบบจะส่งอีเมลให้' }
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
      }),
    }
  )
  .post(
    '/reset-password',
    async ({ body, request, set }) => {
      const limited = await enforceRateLimit(set, [
        ipRateLimitRule('auth-reset-password-ip', request, 10, ONE_HOUR),
      ])
      if (limited) return limited

      try {
        await resetPassword(body.token, body.password)
        return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' }
      } catch (err: any) {
        if (err.message === 'TOKEN_INVALID') {
          set.status = 400
          return { success: false, message: 'ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว' }
        }
        throw err
      }
    },
    {
      body: t.Object({
        token:    t.String(),
        password: t.String({ minLength: 8, maxLength: 72 }),
      }),
    }
  )

// ---- /auth/me ----
// แยกออกมาเป็น instance ต่างหาก เพราะต้องบังคับ login (authMiddleware)
// ต่างจาก route อื่นใน authRoutes ที่ต้องเป็น public (register/login เข้าไม่ได้ถ้าบังคับ login ก่อน)
export const authMeRoutes = new Elysia({ prefix: '/auth' })
  .use(authMiddleware)
  .get('/me', async ({ user, set }) => {
    try {
      const dbUser = await getUserById(user.id)
      return {
        success: true,
        user: {
          id: dbUser.id,
          uuid: dbUser.uuid,
          u_name: dbUser.u_name,
          display_name: dbUser.display_name,
          email: dbUser.email,
          level: dbUser.level,
          point: Number(dbUser.point),
          sales: Number(dbUser.sales),
          user_img: dbUser.user_img,
          writer_tier: dbUser.writer_tier,
          auto_ep_purchase: dbUser.auto_ep_purchase,
          load_all_images: dbUser.load_all_images,
          created_at: dbUser.created_at,
        },
      }
    } catch {
      set.status = 404
      return { success: false, message: 'ไม่พบผู้ใช้งาน' }
    }
  })
  // ---- เปลี่ยนรหัสผ่านตอน login อยู่แล้ว — ยังไม่ได้ผูกบริการอีเมลไว้กู้คืน (2026-08-18)
  // ต้องพิมพ์รหัสผ่านเดิมยืนยันตัวตนแทน ต่างจาก /auth/reset-password ที่ผ่าน token ทางอีเมล ----
  .patch('/me/password', async ({ user, body, set }) => {
    const limited = await enforceRateLimit(set, [
      accountRateLimitRule('auth-change-password-account', user.id, 5, ONE_HOUR),
    ])
    if (limited) return limited

    try {
      await changePassword(BigInt(user.id), body.current_password, body.new_password)
      return { success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' }
    } catch (err: any) {
      if (err.message === 'CURRENT_PASSWORD_INCORRECT') {
        set.status = 400
        return { success: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' }
      }
      if (err.message === 'USER_NOT_FOUND') {
        set.status = 404
        return { success: false, message: 'ไม่พบผู้ใช้งาน' }
      }
      throw err
    }
  }, {
    body: t.Object({
      current_password: t.String({ minLength: 1 }),
      new_password: t.String({ minLength: 8, maxLength: 72 }),
    }),
    detail: { summary: 'เปลี่ยนรหัสผ่าน (ต้องพิมพ์รหัสผ่านเดิมยืนยัน)', tags: ['Auth'] },
  })
