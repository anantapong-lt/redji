import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { env } from './config/env'
import { authRoutes } from './modules/auth/auth.routes'
import { chapterPurchaseRoutes } from './modules/chapter-purchase/chapter-purchase.routes'
import { contentRoutes } from './modules/content/content.routes'
import { genreOptionsRoutes } from './modules/genre-options/genre-options.routes'
import { landingRoutes } from './modules/landing/landing.routes'
import { topupRoutes } from './modules/topup/topup.routes'
import { writerRoutes } from './modules/writer/writer.routes'

const app = new Elysia()
  .use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
    }),
  )
  .use(authRoutes)
  .use(chapterPurchaseRoutes)
  .use(contentRoutes)
  .use(genreOptionsRoutes)
  .use(landingRoutes)
  .use(topupRoutes)
  .use(writerRoutes)

app.listen({ port: env.PORT, maxRequestBodySize: 650 * 1024 * 1024 })

console.log(`API server is running on http://localhost:${env.PORT}`)
