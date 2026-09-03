/**
 * site.config.ts — config กลางของแอป Admin
 *
 * แอปนี้แยกจาก apps/web โดยตั้งใจ (คนละ origin/URL/deployment) แต่ยิงไปที่ apps/api
 * ตัวเดียวกัน ผ่าน /admin/* routes (level >= 9) ที่มีอยู่แล้วสมบูรณ์ — ดู KNOWN_ISSUES.md
 * หัวข้อ "ระบบ Admin แยกสำหรับดูแลหลายเว็บ" สำหรับเหตุผลที่แยก
 */

export const SITE_CONFIG = {
  name: 'Readji Admin',

  /** URL ของ Backend API — อ่านจาก .env.local (ต้องตรงกับ ADMIN_URL ใน apps/api/.env ด้วย
      เพื่อให้ CORS อนุญาต origin ของแอปนี้) */
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '/api',

  /** URL ของเว็บหลัก (apps/web) — ใช้แค่สร้างลิงก์ "ไปหน้าโปรไฟล์" จากหน้ารายละเอียดผู้ใช้
      คนละแอปกับตัวนี้เลย ไม่ได้ fetch ข้าม ๆ กัน */
  webUrl: process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000',

  pageSize: 20,
} as const
