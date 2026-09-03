'use client'

/**
 * components/admin-guard.tsx
 *
 * กัน UX ฝั่ง client เฉยๆ (เด้งไป /login ถ้ายังไม่ login หรือ level < 8) — ไม่ใช่ security gate จริง
 * เหมือนกับที่ proxy.ts เขียนเตือนตัวเองไว้ในฝั่ง apps/web — ตัวป้องกันจริงคือ backend
 * (`admin.routes.ts` เช็ค JWT level >= 8 ทุก endpoint เป็นอย่างน้อย บาง endpoint เข้มกว่านั้นอีก)
 * ต่อให้ผ่านจุดนี้มาได้ก็ยังดึงข้อมูลจริงไม่ได้ถ้า JWT ไม่ใช่ level ที่พอ
 *
 * 2026-07-30 มติเลเวล: 8=แอดมินย่อย, 9=แอดมินรอง, 10=shareholder — ทั้ง 3 level เข้าแอปนี้ได้
 * แต่ละหน้า/ปุ่มค่อยเช็ค user.level เองว่าจะโชว์อะไรให้ทำได้บ้าง
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, isLoading } = useAuthStore()

  useEffect(() => {
    if (isLoading) return
    if (!user || user.level < 8) {
      router.replace('/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        กำลังโหลด...
      </div>
    )
  }

  if (!user || user.level < 8) return null

  return <>{children}</>
}
