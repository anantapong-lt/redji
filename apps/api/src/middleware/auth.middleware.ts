import { jwt } from '@elysiajs/jwt'
import { Elysia } from 'elysia'
import { env } from '../config/env'
import type { UserRole } from '../models/user.model'
import { findActiveUserById } from '../modules/auth/auth.service'

function bearerToken(authorization: string | null): string | null {
  if (!authorization?.startsWith('Bearer ')) return null

  const token = authorization.slice(7).trim()
  return token || null
}

export const authMiddleware = new Elysia({ name: 'auth-middleware' })
  .use(
    jwt({
      name: 'accessJwt',
      secret: env.JWT_ACCESS_SECRET,
      exp: '15m',
    }),
  )
  .macro({
    optionalAuth: (enabled: boolean) => enabled ? ({
      async resolve({ accessJwt, request }) {
        const token = bearerToken(request.headers.get('authorization'))
        const payload = token ? await accessJwt.verify(token) : false

        if (!payload || payload.token_type !== 'access' || typeof payload.sub !== 'string') {
          return { currentUser: null }
        }

        return { currentUser: await findActiveUserById(payload.sub) ?? null }
      },
    }) : {},
    auth: (requiredRole: true | UserRole) => ({
      async resolve({ accessJwt, request, status }) {
        const token = bearerToken(request.headers.get('authorization'))
        const payload = token ? await accessJwt.verify(token) : false

        if (!payload || payload.token_type !== 'access' || typeof payload.sub !== 'string') {
          return status(401, { message: 'กรุณาเข้าสู่ระบบ' })
        }

        const currentUser = await findActiveUserById(payload.sub)
        if (!currentUser) {
          return status(401, { message: 'ไม่พบบัญชีผู้ใช้ที่พร้อมใช้งาน' })
        }

        if (requiredRole !== true && currentUser.role !== requiredRole) {
          return status(403, { message: 'บัญชีนี้ไม่มีสิทธิ์เข้าถึงข้อมูลนี้' })
        }

        return { currentUser }
      },
    }),
  })
