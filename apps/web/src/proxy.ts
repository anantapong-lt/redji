/**
 * proxy.ts — Route protection (server-side)
 *
 * Next.js 16+ เปลี่ยนชื่อจาก middleware.ts → proxy.ts
 * และ export function ต้องชื่อ proxy (หรือ default export)
 *
 * วิธีทำงาน:
 * - หลัง login → auth.store.ts เซ็ต cookie `token` และ `user_level`
 * - Proxy อ่าน cookie เหล่านี้เพื่อตัดสินใจ redirect ก่อน React โหลด
 *
 * ⚠️ Cookie นี้ไม่ใช่ security gate จริง — API backend เป็น gate จริง
 *    Proxy แค่ช่วย UX ให้ redirect เร็วขึ้น ไม่ต้องรอ client
 *
 * 2026-07-30: ไม่มี ADMIN_ROUTES ในไฟล์นี้แล้วโดยตั้งใจ — Admin ย้ายไปเป็นแอปแยก (`apps/admin`,
 * คนละ subdomain/URL) แทนที่จะเป็น path `/admin` ในแอปนี้ ตามมติที่คุยกับ user (ลดพื้นที่ถูกมองเห็น
 * ของโค้ด admin ทั้งหมดไม่ให้ถูกส่งไปให้ผู้ใช้ทั่วไปเลยแม้แต่ไบต์เดียว)
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ─── Route groups ──────────────────────────────────────────────────────────

/** หน้าที่ต้อง login (level ใดก็ได้) — match แบบ prefix (รวม sub-route ทั้งหมด) */
const USER_ROUTES = [
  '/topup',
  '/coin-history',
  '/favorites',
  '/following',
  '/purchase-history',
  '/history',
  '/feed',
  '/settings',
  '/referral',
]

/** หน้าโปรไฟล์ตัวเอง — ต้อง login เฉพาะ path ตรงๆ เท่านั้น (ไม่ใช้ prefix match แบบด้านบน)
    เพราะ /profile/[uuid] (ดูโปรไฟล์คนอื่น) เป็นหน้า public ดูได้โดยไม่ต้อง login เลย */
const USER_EXACT_ROUTES = ['/profile']

/** หน้าที่ต้อง login เพื่อเข้าโซนนักเขียน (level ใดก็ได้ — ดู WRITER_LEVEL_GATED_ROUTES
    ด้านล่างสำหรับจุดที่ต้องเป็นนักเขียนจริง) */
const WRITER_ROUTES = ['/writer']

/** หน้าที่ต้องเป็นนักเขียนจริง (level >= 6) ถึงจะเข้าได้ — สร้าง/แก้ไขนิยาย
    2026-07-30 มติแก้: แยกออกจาก WRITER_ROUTES เดิม เพราะ user ขอให้คนทั่วไปเข้า
    /writer/dashboard กับ /writer/info ได้ (ดูสถานะ+กรอกข้อมูลขอเป็นนักเขียน mock) แต่ยังไม่ให้
    เข้าไปสร้าง/แก้ไขนิยายจริงจนกว่าจะได้รับอนุมัติ (level >= 6 จริง) */
const WRITER_LEVEL_GATED_ROUTES = ['/writer/works']

// Local-only UI preview. This skips browser route guards but never bypasses
// API authentication or authorization.
const BYPASS_WRITER_AUTH =
  process.env.NODE_ENV === 'development' && process.env.WRITER_UI_BYPASS === 'true'

/** หน้าที่ถ้า login แล้วไม่ควรเข้า → redirect ไป / */
const GUEST_ONLY_ROUTES = ['/login', '/register', '/forgot-password']

// ─── Helper ────────────────────────────────────────────────────────────────

function matchesAny(pathname: string, routes: string[]) {
  return routes.some((r) => pathname === r || pathname.startsWith(r + '/'))
}

function matchesExact(pathname: string, routes: string[]) {
  return routes.includes(pathname)
}

// ─── Proxy function ────────────────────────────────────────────────────────
// Next.js 16: ต้องชื่อ proxy (ไม่ใช่ middleware แล้ว)

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (BYPASS_WRITER_AUTH && matchesAny(pathname, WRITER_ROUTES)) {
    return NextResponse.next()
  }

  const token = request.cookies.get('token')?.value
  const levelStr = request.cookies.get('user_level')?.value
  const level = levelStr ? parseInt(levelStr, 10) : 0
  const isLoggedIn = Boolean(token)

  // ถ้า login แล้วพยายามเข้า /login → redirect ไป /
  if (isLoggedIn && matchesAny(pathname, GUEST_ONLY_ROUTES)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Writer routes — ต้อง login เท่านั้น (level ใดก็ได้ — ดูสถานะ/กรอกข้อมูลขอเป็นนักเขียนได้)
  // 2026-07-30 มติแก้ (รอบสอง): เดิม login แล้วแต่ level ไม่ถึง 6 จะเด้งกลับ "/" เงียบๆ ไม่บอก
  // อะไรเลย — user ขอให้คนทั่วไปเข้า /writer/dashboard, /writer/info ได้เลย (ทั้งคู่แค่ต้อง login
  // ไม่ต้องเป็นนักเขียนจริง) ส่วนจุดที่ต้องเป็นนักเขียนจริง (สร้าง/แก้ไขนิยาย) แยกไปเช็คแยกด้านล่าง
  if (matchesAny(pathname, WRITER_ROUTES)) {
    if (!isLoggedIn) {
      return NextResponse.redirect(
        new URL(`/login?from=${encodeURIComponent(pathname)}`, request.url),
      )
    }
  }

  // Writer routes ที่ต้องเป็นนักเขียนจริง (level >= 6) — สร้าง/แก้ไขนิยาย
  if (matchesAny(pathname, WRITER_LEVEL_GATED_ROUTES)) {
    if (level < 6) {
      return NextResponse.redirect(
        new URL(`/become-writer?from=${encodeURIComponent(pathname)}`, request.url),
      )
    }
  }

  // User routes — ต้อง login
  if (matchesAny(pathname, USER_ROUTES)) {
    if (!isLoggedIn) {
      return NextResponse.redirect(
        new URL(`/login?from=${encodeURIComponent(pathname)}`, request.url),
      )
    }
  }

  // หน้าโปรไฟล์ตัวเอง (path ตรงๆ) — ต้อง login เหมือนกัน แต่ /profile/[uuid] ไม่เข้าเงื่อนไขนี้
  if (matchesExact(pathname, USER_EXACT_ROUTES)) {
    if (!isLoggedIn) {
      return NextResponse.redirect(
        new URL(`/login?from=${encodeURIComponent(pathname)}`, request.url),
      )
    }
  }

  return NextResponse.next()
}

// ─── Matcher ───────────────────────────────────────────────────────────────
// บอก Next.js ว่าให้รัน proxy กับ path ไหนบ้าง
// ยกเว้น static files ทั้งหมด

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)).*)',
  ],
}
