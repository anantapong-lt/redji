import { jwt } from '@elysiajs/jwt'
import { Elysia } from 'elysia'
import { env } from '../../config/env'
import { loginBodySchema } from './auth.schema'
import { authenticateWithPassword } from './auth.service'

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60

export const authRoutes = new Elysia({ prefix: '/auth' })
  .use(
    jwt({
      name: 'accessJwt',
      secret: env.JWT_ACCESS_SECRET,
      exp: '15m',
    }),
  )
  .use(
    jwt({
      name: 'refreshJwt',
      secret: env.JWT_REFRESH_SECRET,
      exp: '7d',
    }),
  )
  .post(
    '/login',
    async ({ accessJwt, body, cookie: { refresh_token }, refreshJwt, set }) => {
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
      const refreshToken = await refreshJwt.sign({
        ...claims,
        token_type: 'refresh',
      })

      refresh_token.set({
        value: refreshToken,
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
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
