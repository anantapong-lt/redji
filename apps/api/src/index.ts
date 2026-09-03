// =============================================================
// Novel Platform — API Entry Point
// วางไว้ที่: apps/api/src/index.ts
// =============================================================
//
// ❗ หมายเหตุการ mount routes:
//   - authRoutes          → มี jwt + native cookie support ในตัว (ไม่ share ออกมา)
//   - authMeRoutes        → GET /auth/me แยกออกมา เพราะต้องมี authMiddleware (บังคับ login)
//   - userRoutes          → มี authMiddleware ในตัว
//   - writerRoutes        → มี authMiddleware + onBeforeHandle level check ในตัว
//   - coinRoutes          → มี authMiddleware ในตัว
//   - purchaseRoutes      → มี authMiddleware ในตัว
//   - topupRoutes         → มี authMiddleware บางส่วน (packages = public)
//   - topupWebhookRoutes  → ไม่มี auth (ใช้ HMAC แทน)
//   - socialRoutes        → มี authMiddleware ในตัว
//   - notificationRoutes  → มี authMiddleware ในตัว
//   - feedRoutes          → มี authMiddleware ในตัว (หน้า Feed personalized ล้วนๆ)
//   - adminRoutes         → มี authMiddleware + onBeforeHandle level >= 9
// =============================================================

import { Elysia } from 'elysia'
import { openapi } from '@elysiajs/openapi'
import { cors } from '@elysiajs/cors'
import { enforceRateLimit, ipRateLimitRule } from './lib/rate-limit'

// ---- Routes ----
import { authRoutes, authMeRoutes } from './modules/auth/auth.routes'
import { worksRoutes, categoryRoutes, tagRoutes, carouselRoutes, webContactRoutes, faqRoutes, announcementRoutes } from './modules/works/works.routes'
import { userRoutes, publicUserRoutes } from './modules/user/user.routes'
import { writerRoutes }        from './modules/writer/writer.routes'
import { coinRoutes }          from './modules/coin/coin.routes'
import { topupRoutes, topupWebhookRoutes } from './modules/topup/topup.routes'
import { purchaseRoutes }      from './modules/purchase/purchase.routes'
import { socialRoutes, notificationRoutes } from './modules/social/social.routes'
import { feedRoutes }                       from './modules/feed/feed.routes'
import { adminRoutes }                      from './modules/admin/admin.routes'
import { adminWorksRoutes }                 from './modules/admin/admin-works.routes'
import { adminHouseWriterRoutes }           from './modules/admin/admin-house-writer.routes'
import { adminSquadRoutes }                 from './modules/admin/admin-squad.routes'
import { adminPermissionsRoutes }           from './modules/admin/admin-permissions.routes'
import { adminTagsRoutes }                  from './modules/admin/admin-tags.routes'
import { adminAnalyticsRoutes }             from './modules/admin/admin-analytics.routes'
import { adminRedeemCodesRoutes }           from './modules/admin/admin-redeem-codes.routes'
import { adminWebContactsRoutes, adminFaqRoutes } from './modules/admin/admin-contact-page.routes'
import { redeemRoutes }                     from './modules/redeem/redeem.routes'
import { referralRoutes }                   from './modules/redeem/referral.routes'
import { ttsAdminRoutes, ttsReaderRoutes, ttsWriterRoutes } from './modules/tts/tts.routes'
import { ttsEditorWriterRoutes } from './modules/tts/tts-editor.routes'

// 2026-08-10: Bun default = 128MB (1024*1024*128) — ไม่พอสำหรับ "อัพนิยายหลายเรื่องพร้อมกัน"
// ฝั่ง admin (zip ก้อนใหญ่ ~100 เรื่อง ปกละหลาย MB รวมกันได้ถึง ~500MB ตามที่คุยกับ user ไว้)
// ต้องตั้งตรงนี้ระดับ root instance เท่านั้น (ตั้งใน route file ย่อยไม่ได้ผล เพราะ Bun เช็คก่อน
// request จะเข้าถึง routing ด้วยซ้ำ) ผลคือเพดานนี้กลายเป็นค่ากลางของทุก route ในแอป ไม่ใช่แค่ route
// อัพนิยายหลายเรื่อง — endpoint อื่นๆ ทุกตัวยังมีเพดานของตัวเองเช็คซ้ำอีกชั้นในโค้ด (5MB cover,
// 50MB zip ตอน, 15MB carousel ฯลฯ) เลยไม่ได้เปิดช่องให้ endpoint พวกนั้นรับไฟล์ใหญ่ขึ้นจริง
const MAX_REQUEST_BODY_SIZE = 550 * 1024 * 1024 // 550MB

// Broad protection against trivial scraping/flooding. This limit intentionally
// fails open if Redis is unavailable; sensitive public and authenticated
// mutations below each have narrower fail-closed limits.
const API_REQUESTS_PER_IP_PER_MINUTE = readPositiveInt(
  process.env.API_REQUESTS_PER_IP_PER_MINUTE,
  300,
)

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

// Railway (and most PaaS hosts) assign the port dynamically via $PORT; the
// hardcoded fallback keeps local dev unchanged.
const port = process.env.PORT ? Number(process.env.PORT) : 3001

const app = new Elysia({ serve: { maxRequestBodySize: MAX_REQUEST_BODY_SIZE } })
  // ---- CORS ----
  // อนุญาตเฉพาะ origin ของ frontend ที่รู้จักเท่านั้น (ไม่ใช่ '*' เพราะต้องส่ง cookie ข้าม origin
  // ด้วย credentials:true คู่กับ origin:'*' ผิดกฎ CORS spec — ต้องระบุ origin ตรงๆ)
  // 2026-07-30: เพิ่ม ADMIN_URL เข้ามาด้วย — apps/admin เป็นคนละแอป/คนละ origin จาก apps/web
  // แต่ยิงมาที่ APIตัวเดียวกันนี้ (ไม่มี backend แยก) เลยต้อง allow ทั้งคู่พร้อมกัน
  .use(
    cors({
      origin: [
        process.env.FRONTEND_URL ?? 'http://localhost:3000',
        process.env.ADMIN_URL ?? 'http://localhost:3002',
      ],
      credentials: true,
    })
  )
  // ---- OpenAPI documentation (Scalar) ----
  .use(openapi({
    documentation: {
      info: { title: 'Novel Platform API', version: '1.0.0' },
      tags: [
        { name: 'Auth',       description: 'Authentication endpoints' },
        { name: 'Works',      description: 'Manga/Novel listing & reading' },
        { name: 'Categories', description: 'Content categories' },
        { name: 'Carousels',  description: 'Hero banner promo images' },
        { name: 'Writer',     description: 'Writer management' },
        { name: 'Coins',      description: 'Coin balance & history' },
        { name: 'Topup',      description: 'Topup packages & webhook' },
        { name: 'Redeem',     description: 'Redeem codes (instant coins / topup bonus %)' },
        { name: 'Purchase',      description: 'Episode purchase' },
        { name: 'Social',        description: 'Follow, Favorites, Comments, Likes' },
        { name: 'Feed',          description: 'หน้าฟีด (personalized) — อ่านล่าสุด/กดดาว/บุ๊คมาร์ค/นักเขียนที่ติดตาม' },
        { name: 'Notifications', description: 'การแจ้งเตือน' },
        { name: 'Admin',         description: 'Admin panel (level 9+)' },
      ],
    },
    path: '/swagger',
  }))
  .onBeforeHandle(async ({ request, set }) => {
    const pathname = new URL(request.url).pathname
    // Keep the local documentation usable without filling the public limiter.
    if (request.method === 'OPTIONS' || pathname === '/swagger' || pathname.startsWith('/swagger/')) return

    return enforceRateLimit(set, [
      ipRateLimitRule(
        'api-public-request',
        request,
        API_REQUESTS_PER_IP_PER_MINUTE,
        60,
        'allow',
      ),
    ])
  })

  // ---- Phase 2: Auth ----
  .use(authRoutes)
  .use(authMeRoutes)

  // ---- Phase 3: Content ----
  .use(worksRoutes)
  .use(categoryRoutes)
  .use(tagRoutes)
  .use(carouselRoutes)
  .use(webContactRoutes)
  .use(faqRoutes)
  .use(announcementRoutes)

  // ---- Phase 4: Writer ----
  // userRoutes (มี /me แบบ static path) mount ก่อน publicUserRoutes (มี /:uuid แบบ
  // dynamic param) เสมอ กัน routing ชนกันเผื่อ Elysia ไม่ได้ prioritize static เหนือ dynamic
  .use(userRoutes)
  .use(publicUserRoutes)
  .use(writerRoutes)
  .use(ttsWriterRoutes)
  .use(ttsEditorWriterRoutes)
  .use(ttsReaderRoutes)

  // ---- Phase 5: Coin / Topup / Purchase ----
  .use(coinRoutes)
  .use(topupRoutes)
  .use(topupWebhookRoutes)   // webhook แยกออกมา (ไม่มี auth middleware)
  .use(purchaseRoutes)
  .use(redeemRoutes)
  .use(referralRoutes)

  // ---- Phase 6: Social / Notifications / Feed ----
  .use(socialRoutes)
  .use(notificationRoutes)
  .use(feedRoutes)

  // ---- Phase 7: Admin ----
  .use(adminRoutes)
  .use(adminWorksRoutes)
  .use(adminHouseWriterRoutes)
  .use(adminSquadRoutes)
  .use(adminPermissionsRoutes)
  .use(adminTagsRoutes)
  .use(adminAnalyticsRoutes)
  .use(adminRedeemCodesRoutes)
  .use(adminWebContactsRoutes)
  .use(adminFaqRoutes)
  .use(ttsAdminRoutes)

  // API responses are not intended to be framed or content-sniffed. OpenAPI
  // is the sole HTML/JS response and keeps its own policy so its UI can run.
  .onAfterHandle(({ request, set }) => {
    const pathname = new URL(request.url).pathname
    if (pathname !== '/swagger' && !pathname.startsWith('/swagger/')) {
      set.headers['content-security-policy'] = "default-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    }
    set.headers['x-content-type-options'] = 'nosniff'
    set.headers['x-frame-options'] = 'DENY'
    set.headers['referrer-policy'] = 'strict-origin-when-cross-origin'
    set.headers['permissions-policy'] = 'camera=(), microphone=(), geolocation=(), payment=()'
    if (process.env.NODE_ENV === 'production') {
      set.headers['strict-transport-security'] = 'max-age=63072000; includeSubDomains; preload'
    }
  })

  // ---- Global error handler ----
  // แต่ละ route ปกติ catch error ที่รู้จักแล้วเอง (throw new Error('CODE') → map เป็น
  // response ปกติภายใน route นั้นๆ) — onError นี้ดักเฉพาะที่หลุดรอดออกมาจริงๆ (เช่น Kysely
  // NoResultError, sharp throw ตอนไฟล์ corrupt) ที่ไม่เคยมีจุดกลาง log/sanitize มาก่อน
  // (พบจาก audit ทั้งโปรเจกต์) — ไม่แตะ VALIDATION
  // ปล่อยให้ Elysia แสดงแบบเดิม (ทดสอบผ่านมาตลอดทั้งเซสชันแล้วว่า frontend คุ้นกับ
  // รูปแบบเดิมอยู่แล้ว ไม่อยากเปลี่ยนพฤติกรรมที่ทดสอบผ่านแล้วโดยไม่จำเป็น)
  .onError(({ code, error, set }) => {
    if (code === 'VALIDATION') return

    console.error(`[unhandled error] ${code}:`, error)
    set.status = 500
    return { success: false, message: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง' }
  })

  .listen(port)

console.log(`🚀 API running at http://localhost:${port}`)
console.log(`📖 API docs at http://localhost:${port}/swagger`)
