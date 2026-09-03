import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { env } from './config/env'
import { authRoutes } from './modules/auth/auth.routes'

const app = new Elysia()
  .use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
    }),
  )
  .use(authRoutes)

app.listen(env.PORT)

console.log(`API server is running on http://localhost:${env.PORT}`)
