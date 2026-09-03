'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { IconInput, PasswordInput } from './form-inputs'
import { CloudflarePlaceholder } from './cloudflare-placeholder'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import type { AuthResponse } from '@/types'

const loginSchema = z.object({
  login: z.string().min(1, 'กรุณากรอกชื่อบัญชีผู้ใช้งานหรืออีเมล'),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginValues) {
    setSubmitting(true)
    try {
      const res = await api.post<AuthResponse>('/auth/login', values, { public: true })
      setAuth(res.user, res.access_token)
      router.push('/')
    } catch (err: any) {
      toast.error(err?.message ?? 'เข้าสู่ระบบไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div>
        <IconInput
          icon={<User className="size-4" />}
          placeholder="ชื่อบัญชีผู้ใช้งานหรืออีเมล"
          autoComplete="username"
          {...register('login')}
        />
        {errors.login && <p className="mt-1 text-xs text-destructive">{errors.login.message}</p>}
      </div>

      <div>
        <PasswordInput
          icon={<Lock className="size-4" />}
          placeholder="รหัสผ่าน"
          autoComplete="current-password"
          {...register('password')}
        />
        {errors.password && (
          <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <CloudflarePlaceholder />

      <Button type="submit" disabled={submitting} className="h-11 w-full rounded-lg text-base">
        {submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
      </Button>

      <div className="flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-muted-foreground hover:text-foreground">
          ลืมรหัสผ่าน
        </Link>
        <Link href="/register" className="text-primary hover:underline">
          สมัครสมาชิก
        </Link>
      </div>
    </form>
  )
}
