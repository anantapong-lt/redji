import type { MetadataRoute } from 'next'
import { SITE_CONFIG } from '@/site.config'

/**
 * app/robots.ts — 2026-08-18, ใหม่
 *
 * Disallow list อ้างอิงตรงจาก USER_ROUTES/WRITER_ROUTES ใน proxy.ts (หน้าที่ต้อง login อยู่แล้ว —
 * anonymous crawler โดน redirect ไป /login เองอยู่ดี ไม่มีเนื้อหาจริงให้ index) — ไม่ใส่ /profile
 * เพราะ /profile เฉยๆ (ของตัวเอง) redirect ไป login เองอยู่แล้ว ส่วน /profile/[uuid] (ดูคนอื่น)
 * เป็น public จริง ต้องให้ index ได้ — ใส่ prefix /profile จะบล็อกโดนทั้งคู่โดยไม่ตั้งใจ
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/topup',
        '/coin-history',
        '/favorites',
        '/following',
        '/purchase-history',
        '/history',
        '/feed',
        '/settings',
        '/referral',
        '/writer',
        '/login',
        '/register',
        '/forgot-password',
        '/reset-password',
      ],
    },
    sitemap: `${SITE_CONFIG.siteUrl}/sitemap.xml`,
  }
}
