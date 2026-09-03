'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IconInput, PasswordInput } from './form-inputs'
import { CloudflarePlaceholder } from './cloudflare-placeholder'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import type { AuthResponse } from '@/types'

const registerSchema = z
  .object({
    u_name: z
      .string()
      .min(3, 'ชื่อผู้ใช้งานต้องมีอย่างน้อย 3 ตัวอักษร')
      .max(30, 'ชื่อผู้ใช้งานต้องไม่เกิน 30 ตัวอักษร'),
    email: z.string().email('อีเมลไม่ถูกต้อง'),
    password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร').max(72),
    password_confirm: z.string(),
    terms: z.boolean().refine((v) => v === true, {
      message: 'กรุณายอมรับข้อตกลงและเงื่อนไขการใช้และบริการ',
    }),
  })
  .refine((data) => data.password === data.password_confirm, {
    message: 'รหัสผ่านไม่ตรงกัน',
    path: ['password_confirm'],
  })

type RegisterValues = z.infer<typeof registerSchema>

export function RegisterForm() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [submitting, setSubmitting] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { terms: false },
  })

  async function onSubmit(values: RegisterValues) {
    setSubmitting(true)
    try {
      // display_name ยังไม่มีช่องแยกใน design นี้ — ใช้ u_name ไปก่อน (แก้ทีหลังในหน้าโปรไฟล์ได้)
      await api.post(
        '/auth/register',
        {
          u_name: values.u_name,
          display_name: values.u_name,
          email: values.email,
          password: values.password,
        },
        { public: true },
      )

      // /auth/register ไม่ออก token ให้ — login ต่อทันทีด้วย credential เดิม
      const loginRes = await api.post<AuthResponse>(
        '/auth/login',
        { login: values.email, password: values.password },
        { public: true },
      )
      setAuth(loginRes.user, loginRes.access_token)
      router.push('/')
    } catch (err: any) {
      toast.error(err?.message ?? 'สมัครสมาชิกไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          ชื่อผู้ใช้งาน
        </label>
        <IconInput placeholder="กรอกชื่อบัญชีผู้ใช้งาน" autoComplete="username" {...register('u_name')} />
        {errors.u_name && <p className="mt-1 text-xs text-destructive">{errors.u_name.message}</p>}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">อีเมล</label>
        <IconInput
          type="email"
          placeholder="กรอกอีเมลลงในช่องนี้"
          autoComplete="email"
          {...register('email')}
        />
        {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">รหัสผ่าน</label>
        <PasswordInput
          icon={<Lock className="size-4" />}
          placeholder="รหัสผ่าน"
          autoComplete="new-password"
          {...register('password')}
        />
        {errors.password && (
          <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          ยืนยันรหัสผ่าน
        </label>
        <PasswordInput
          icon={<Lock className="size-4" />}
          placeholder="ยืนยันรหัสผ่าน"
          autoComplete="new-password"
          {...register('password_confirm')}
        />
        {errors.password_confirm && (
          <p className="mt-1 text-xs text-destructive">{errors.password_confirm.message}</p>
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 text-sm text-foreground">
        <Controller
          control={control}
          name="terms"
          render={({ field }) => (
            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
        <span className="select-none">ยอมรับ</span>
        <button
          type="button"
          onClick={() => setTermsOpen(true)}
          className="cursor-pointer text-blue-600 underline underline-offset-2 hover:text-blue-700"
        >
          ข้อตกลงและเงื่อนไขการใช้และบริการ
        </button>
      </div>
      {errors.terms && (
        <p className="-mt-2 text-center text-xs text-destructive">{errors.terms.message}</p>
      )}

      <CloudflarePlaceholder />

      <Button type="submit" disabled={submitting} className="h-11 w-full rounded-lg text-base">
        {submitting ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิก'}
      </Button>

      <div className="flex justify-end">
        <Link href="/login" className="text-sm text-primary hover:underline">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </div>

      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>ข้อตกลงและเงื่อนไขการใช้และบริการเว็บไซต์ Readji.com</DialogTitle>
          </DialogHeader>
          <div className="min-h-[200px]" />
        </DialogContent>
      </Dialog>
    </form>
  )
}
