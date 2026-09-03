/**
 * site.config.ts — config กลางของเว็บ
 *
 * ทำไมต้องมีไฟล์นี้?
 * เราจะมีเว็บ 2 เว็บจาก codebase เดียวกัน:
 *   - เว็บ 1: นิยาย (type = 'novel')
 *   - เว็บ 2: การ์ตูน (type = 'manga')
 * แค่เปลี่ยน type บรรทัดเดียว แล้ว clone repo ไปใช้กับอีกเว็บได้เลย
 */

export const SITE_CONFIG = {
  /** เปลี่ยนเป็น 'manga' สำหรับเว็บการ์ตูน */
  type: 'novel' as 'novel' | 'manga',

  /** ชื่อเว็บ — แสดงใน tab, metadata, navbar */
  name: 'Readji',

  tagline: 'อ่านนิยายออนไลน์ฟรี',

  description: 'แหล่งรวมนิยายออนไลน์และการ์ตูนคุณภาพ อัปเดตทุกวัน',

  // "||" ไม่ใช่ "??" ตั้งใจ — env var ที่ตั้งไว้เป็นค่าว่างเปล่า (empty string, พลาด
  // ตอนตั้งบน Railway เป็นต้น) ไม่ใช่ nullish เลยไม่ fallback ให้ถ้าใช้ "??" ผลคือ
  // new URL('') ใน layout.tsx จะ throw ทำทั้งเว็บ 500 (เจอเคสจริง 2026-08-14)

  /** URL ของ Backend API — อ่านจาก .env.local */
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',

  /** URL จริงของเว็บนี้ (ไม่ใช่ API) — ใช้ทำ metadataBase/canonical/og:url ตอนทำ SEO
      เปลี่ยนเป็นโดเมนจริงผ่าน .env.local ตอน deploy จริง (NEXT_PUBLIC_SITE_URL) */
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',

  /**
   * Admin runs as a separate web origin on purpose. Navigating with a normal
   * browser link keeps its local login session isolated from the reader site.
   * Set NEXT_PUBLIC_ADMIN_URL to the separately exposed admin URL when testing
   * remotely or deploying.
   */
  adminUrl: process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3002',

  /** จำนวนรายการต่อหน้าใน pagination */
  pageSize: 24,
} as const

// Shorthand helpers — ใช้แทน SITE_CONFIG.type === 'novel' ตลอด
export const isNovelFirst = SITE_CONFIG.type === 'novel'
export const isMangaFirst = SITE_CONFIG.type === 'manga'

/** ชื่อประเภทหลักภาษาไทย เช่น "นิยาย" หรือ "การ์ตูน" */
export const primaryTypeName = isNovelFirst ? 'นิยาย' : 'การ์ตูน'
