'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lock, User } from 'lucide-react'
import { CloudflarePlaceholder } from './cloudflare-placeholder'
import { IconInput, PasswordInput } from './form-inputs'

const loginSchema = z.object({
  login: z.string().min(1, 'กรุณากรอกชื่อบัญชีผู้ใช้งานหรืออีเมล'),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const [previewMessage, setPreviewMessage] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  function onSubmit() {
    setPreviewMessage('โหมดตัวอย่าง UI — ระบบเข้าสู่ระบบยังไม่เปิดใช้งาน')
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
        {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
      </div>

      <CloudflarePlaceholder />

      <button type="submit" className="h-11 w-full rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90">
        เข้าสู่ระบบ
      </button>

      {previewMessage && (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-center text-sm text-muted-foreground">
          {previewMessage}
        </p>
      )}

      <div className="flex items-center justify-between text-sm">
        <span aria-disabled="true" title="ยังไม่เปิดใช้งาน" className="cursor-not-allowed text-muted-foreground opacity-45">
          ลืมรหัสผ่าน
        </span>
        <Link href="/register" className="text-primary hover:underline">สมัครสมาชิก</Link>
      </div>
    </form>
  )
}
