'use client'

/**
 * app/login/page.tsx — หน้า login ของแอป Admin
 *
 * ใช้ POST /auth/login ตัวเดียวกับ apps/web (backend เดียวกัน ไม่มี endpoint แยก) แต่เพิ่มเช็ค
 * level >= 8 ทันทีหลัง login สำเร็จ (8=แอดมินย่อย ขึ้นไป) — ถ้าไม่ใช่ admin จะไม่เก็บ session เลย
 * (ไม่ setAuth) กันบัญชีที่ไม่มีสิทธิ์ค้าง token อยู่ในเครื่องเปล่าๆ
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import type { AdminSelf } from '@/types'

interface LoginResponse {
  access_token: string
  user: AdminSelf
}

export default function LoginPage() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const res = await api.post<LoginResponse>('/auth/login', { login, password }, { public: true })

      if (res.user.level < 8) {
        setError('บัญชีนี้ไม่มีสิทธิ์เข้าถึง Admin')
        return
      }

      setAuth(res.user, res.access_token)
      router.push('/users')
    } catch (err: any) {
      setError(err?.message ?? 'เข้าสู่ระบบไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={handleSubmit} className="admin-surface w-full max-w-md rounded-[1.75rem] p-8 shadow-[0_30px_80px_-42px_rgb(45_29_32_/_0.62)] sm:p-10">
        <div className="mb-7 flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_24px_-13px_rgb(84_37_43_/_0.85)]"><ShieldCheck className="size-5" /></div>
          <div>
            <p className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground">STAFF ACCESS</p>
            <h1 className="mt-0.5 text-2xl font-extrabold tracking-[-0.035em] text-foreground">Readji Admin</h1>
          </div>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">เข้าถึงได้เฉพาะทีมงานที่ได้รับสิทธิ์เท่านั้น</p>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-foreground">ชื่อบัญชีผู้ใช้งานหรืออีเมล</label>
          <Input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" required />
        </div>

        <div className="mb-6">
          <label className="mb-1.5 block text-sm font-medium text-foreground">รหัสผ่าน</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </Button>
      </form>
    </div>
  )
}
