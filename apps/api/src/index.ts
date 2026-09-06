import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { env } from './config/env'
import { adminUsersRoutes } from './modules/admin-users/admin-users.routes'
import { adminContentsRoutes } from './modules/admin-contents/admin-contents.routes'
import { adminDashboardRoutes } from './modules/admin-dashboard/admin-dashboard.routes'
import { adminSiteRoutes } from './modules/admin-site/admin-site.routes'
import { authRoutes } from './modules/auth/auth.routes'
import { chapterPurchaseRoutes } from './modules/chapter-purchase/chapter-purchase.routes'
import { contentRoutes } from './modules/content/content.routes'
import { genreOptionsRoutes } from './modules/genre-options/genre-options.routes'
import { landingRoutes } from './modules/landing/landing.routes'
import { topupRoutes } from './modules/topup/topup.routes'
import { publishScheduledChapters } from './modules/writer/chapter/writer-chapter.service'
import { writerRoutes } from './modules/writer/writer.routes'

const CHAPTER_PUBLISH_INTERVAL_MS = 60_000

async function runChapterPublisher() {
  try {
    const publishedCount = await publishScheduledChapters()
    if (publishedCount > 0) console.log(`Published ${publishedCount} scheduled chapter(s)`)
  } catch (error) {
    console.error('Unable to publish scheduled chapters', error)
  }
}

const app = new Elysia()
  .use(
    cors({
      origin: [env.WEB_ORIGIN, env.ADMIN_ORIGIN],
      credentials: true,
    }),
  )
  .use(adminUsersRoutes)
  .use(adminContentsRoutes)
  .use(adminDashboardRoutes)
  .use(adminSiteRoutes)
  .use(authRoutes)
  .use(chapterPurchaseRoutes)
  .use(contentRoutes)
  .use(genreOptionsRoutes)
  .use(landingRoutes)
  .use(topupRoutes)
  .use(writerRoutes)

app.listen({ port: env.PORT, maxRequestBodySize: 650 * 1024 * 1024 })

void runChapterPublisher()
setInterval(() => void runChapterPublisher(), CHAPTER_PUBLISH_INTERVAL_MS)

console.log(`API server is running on http://localhost:${env.PORT}`)
