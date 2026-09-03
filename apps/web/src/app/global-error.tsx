'use client'

/**
 * app/global-error.tsx — จับ error ที่รอดพ้น error.tsx ปกติ (เกิดใน root layout/Providers เอง)
 *
 * 2026-08-09: เจอบั๊กจริงจาก user — บัญชี/browser ที่ผ่าน session/redesign มาหลายรอบ (localStorage
 * เก็บ user/token เก่าที่ shape ไม่ตรงกับโค้ดปัจจุบันแล้ว) ทำให้หน้าเว็บ crash ตอน render แบบไม่มี
 * ข้อความอะไรให้เห็นเลย ค้างเป็น skeleton ตลอดไปเพราะไม่มี error boundary คลุมไว้ก่อนหน้านี้ — ต้อง
 * ล้าง localStorage เองผ่าน DevTools ถึงจะหาย ผู้ใช้จริงไม่มีทางรู้วิธีนี้ได้เลย
 *
 * ไฟล์นี้ทำ 2 อย่าง: (1) โชว์ข้อความ error จริงแทนหน้าค้างเงียบๆ (2) ปุ่ม "ล้างข้อมูลแล้วโหลดใหม่"
 * เคลียร์ localStorage/cookie ที่เก็บ auth state ทิ้งเอง ไม่ต้องพึ่ง DevTools — กลไกเดียวกับที่ user
 * เพิ่งทำเองตอนแก้บั๊กนี้ (Clear site data ใน Application tab) แค่ทำเป็นปุ่มให้กดเองได้เลย
 *
 * ต้องมี <html>/<body> เองเพราะ global-error แทนที่ root layout ทั้งอัน (ตาม Next.js docs) —
 * ไม่ครอบด้วย <Providers> เพราะถ้าตัว state ที่เสียอยู่ใน Providers เอง ครอบซ้ำจะ crash วนอีกรอบ
 */

import { notoSansThai } from '@/lib/fonts'
import './globals.css'

function clearAuthDataAndReload() {
  try {
    localStorage.clear()
    sessionStorage.clear()
    document.cookie.split(';').forEach((c) => {
      const name = c.split('=')[0].trim()
      document.cookie = `${name}=; path=/; max-age=0`
    })
  } catch {
    // ล้างได้เท่าที่ล้างได้ ต่อให้ error ตรงนี้ก็ยัง reload ต่อ
  }
  window.location.href = '/'
}

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <html lang="th">
      <body className={`${notoSansThai.variable} font-sans antialiased`}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-xl font-bold text-foreground">เกิดข้อผิดพลาดบางอย่าง</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            หน้าเว็บโหลดไม่สำเร็จ ส่วนใหญ่แก้ได้ด้วยการล้างข้อมูลที่ค้างอยู่แล้วโหลดใหม่
          </p>
          {error?.message && (
            <p className="max-w-md rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{error.message}</p>
          )}
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => unstable_retry()}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              ลองอีกครั้ง
            </button>
            <button
              type="button"
              onClick={clearAuthDataAndReload}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              ล้างข้อมูลแล้วโหลดใหม่
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
