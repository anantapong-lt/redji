import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { env } from './config/env'
import { authRoutes } from './modules/auth/auth.routes'
import { genreOptionsRoutes } from './modules/genre-options/genre-options.routes'
import { writerRoutes } from './modules/writer/writer.routes'

const app = new Elysia()
  .use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
    }),
  )
  .use(authRoutes)
  .use(genreOptionsRoutes)
  .use(writerRoutes)

app.listen(env.PORT)

console.log(`API server is running on http://localhost:${env.PORT}`)
