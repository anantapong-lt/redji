import { jwt } from '@elysiajs/jwt'
import { Elysia } from 'elysia'
import { env } from '../../config/env'
import { authMiddleware } from '../../middleware/auth.middleware'
import { loginBodySchema } from './auth.schema'
import {
  authenticateWithPassword,
  createAuthSession,
  findActiveUserById,
  revokeAuthSession,
  rotateAuthSession,
} from './auth.service'

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60
const REFRESH_COOKIE_NAME = env.NODE_ENV === 'production' ? '__Host-refresh_token' : 'refresh_token'
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(authMiddleware)
  .use(
    jwt({
      name: 'refreshJwt',
      secret: env.JWT_REFRESH_SECRET,
      exp: '7d',
    }),
  )
  .post(
    '/login',
    async ({ accessJwt, body, cookie, refreshJwt, set }) => {
      const result = await authenticateWithPassword(body.email, body.password)

      if (result.status === 'invalid_credentials') {
        set.status = 401
        return { message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }
      }

      if (result.status === 'inactive') {
        set.status = 403
        return { message: 'บัญชีนี้ไม่สามารถเข้าใช้งานได้' }
      }

      const claims = {
        sub: result.user.id,
        role: result.user.role,
      }
      const accessToken = await accessJwt.sign({
        ...claims,
        token_type: 'access',
      })
      const refreshTokenId = crypto.randomUUID()
      const sessionId = await createAuthSession(result.user.id, refreshTokenId)
      const refreshToken = await refreshJwt.sign({
        ...claims,
        jti: refreshTokenId,
        sid: sessionId,
        token_type: 'refresh',
      })

      cookie[REFRESH_COOKIE_NAME].set({
        value: refreshToken,
        ...REFRESH_COOKIE_OPTIONS,
        maxAge: REFRESH_TOKEN_TTL_SECONDS,
      })

      return {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        user: result.user,
      }
    },
    { body: loginBodySchema },
  )
  .post('/refresh', async ({ accessJwt, cookie, refreshJwt, set }) => {
    const refreshCookie = cookie[REFRESH_COOKIE_NAME]
    const refreshToken = refreshCookie.value

    if (typeof refreshToken !== 'string') {
      set.status = 401
      return { message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง' }
    }

    const payload = await refreshJwt.verify(refreshToken)
    if (
      !payload
      || payload.token_type !== 'refresh'
      || typeof payload.sub !== 'string'
      || typeof payload.jti !== 'string'
      || typeof payload.sid !== 'string'
    ) {
      refreshCookie.set({
        value: '',
        ...REFRESH_COOKIE_OPTIONS,
        expires: new Date(0),
        maxAge: 0,
      })
      set.status = 401
      return { message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง' }
    }

    const nextRefreshTokenId = crypto.randomUUID()
    const rotated = await rotateAuthSession(
      payload.sid,
      payload.sub,
      payload.jti,
      nextRefreshTokenId,
    )
    if (!rotated) {
      await revokeAuthSession(payload.sid, payload.sub)
      refreshCookie.set({
        value: '',
        ...REFRESH_COOKIE_OPTIONS,
        expires: new Date(0),
        maxAge: 0,
      })
      set.status = 401
      return { message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง' }
    }

    const user = await findActiveUserById(payload.sub)
    if (!user) {
      await revokeAuthSession(payload.sid, payload.sub)
      refreshCookie.set({
        value: '',
        ...REFRESH_COOKIE_OPTIONS,
        expires: new Date(0),
        maxAge: 0,
      })
      set.status = 401
      return { message: 'ไม่พบบัญชีผู้ใช้ที่พร้อมใช้งาน' }
    }

    const claims = { sub: user.id, role: user.role }
    const accessToken = await accessJwt.sign({
      ...claims,
      token_type: 'access',
    })
    const nextRefreshToken = await refreshJwt.sign({
      ...claims,
      jti: nextRefreshTokenId,
      sid: payload.sid,
      token_type: 'refresh',
    })

    refreshCookie.set({
      value: nextRefreshToken,
      ...REFRESH_COOKIE_OPTIONS,
      maxAge: REFRESH_TOKEN_TTL_SECONDS,
    })

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      user,
    }
  })
  .get('/me', ({ currentUser }) => ({ user: currentUser }), { auth: true })
  .post('/logout', async ({ cookie, refreshJwt }) => {
    const refreshCookie = cookie[REFRESH_COOKIE_NAME]
    const refreshToken = refreshCookie.value

    if (typeof refreshToken === 'string') {
      const payload = await refreshJwt.verify(refreshToken)
      if (payload && typeof payload.sid === 'string' && typeof payload.sub === 'string') {
        await revokeAuthSession(payload.sid, payload.sub)
      }
    }

    refreshCookie.set({
      value: '',
      ...REFRESH_COOKIE_OPTIONS,
      expires: new Date(0),
      maxAge: 0,
    })
    return { success: true }
  })
