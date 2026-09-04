'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lock, X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { CloudflarePlaceholder } from './cloudflare-placeholder'
import { IconInput, PasswordInput } from './form-inputs'

const registerSchema = z
  .object({
    u_name: z.string().min(3, 'ชื่อผู้ใช้งานต้องมีอย่างน้อย 3 ตัวอักษร').max(30, 'ชื่อผู้ใช้งานต้องไม่เกิน 30 ตัวอักษร'),
    email: z.string().email('อีเมลไม่ถูกต้อง'),
    password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร').max(72),
    password_confirm: z.string(),
    terms: z.boolean().refine((value) => value, 'กรุณายอมรับข้อตกลงและเงื่อนไขการใช้และบริการ'),
  })
  .refine((data) => data.password === data.password_confirm, {
    message: 'รหัสผ่านไม่ตรงกัน',
    path: ['password_confirm'],
  })

type RegisterValues = z.infer<typeof registerSchema>

export function RegisterForm() {
  const [termsOpen, setTermsOpen] = useState(false)
  const [previewMessage, setPreviewMessage] = useState('')
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { terms: false },
  })

  function onSubmit() {
    setPreviewMessage('โหมดตัวอย่าง UI — ระบบสมัครสมาชิกยังไม่เปิดใช้งาน')
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">ชื่อผู้ใช้งาน</label>
          <IconInput placeholder="กรอกชื่อบัญชีผู้ใช้งาน" autoComplete="username" {...register('u_name')} />
          {errors.u_name && <p className="mt-1 text-xs text-destructive">{errors.u_name.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">อีเมล</label>
          <IconInput type="email" placeholder="กรอกอีเมลลงในช่องนี้" autoComplete="email" {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">รหัสผ่าน</label>
          <PasswordInput icon={<Lock className="size-4" />} placeholder="รหัสผ่าน" autoComplete="new-password" {...register('password')} />
          {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">ยืนยันรหัสผ่าน</label>
          <PasswordInput icon={<Lock className="size-4" />} placeholder="ยืนยันรหัสผ่าน" autoComplete="new-password" {...register('password_confirm')} />
          {errors.password_confirm && <p className="mt-1 text-xs text-destructive">{errors.password_confirm.message}</p>}
        </div>

        <div className="flex items-center justify-center gap-1.5 text-sm text-foreground">
          <Controller
            name="terms"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="accept-terms"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                onBlur={field.onBlur}
                ref={field.ref}
                aria-invalid={Boolean(errors.terms)}
                aria-label="ยอมรับข้อตกลงและเงื่อนไขการใช้และบริการ"
              />
            )}
          />
          <span className="select-none">ยอมรับ</span>
          <button type="button" onClick={() => setTermsOpen(true)} className="cursor-pointer text-blue-600 underline underline-offset-2 hover:text-blue-700">
            ข้อตกลงและเงื่อนไขการใช้และบริการ
          </button>
        </div>
        {errors.terms && <p className="-mt-2 text-center text-xs text-destructive">{errors.terms.message}</p>}

        <CloudflarePlaceholder />

        <button type="submit" className="h-11 w-full rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          สมัครสมาชิก
        </button>

        {previewMessage && (
          <p role="status" className="rounded-lg bg-muted px-3 py-2 text-center text-sm text-muted-foreground">
            {previewMessage}
          </p>
        )}

        <div className="flex justify-end">
          <Link href="/login" className="text-sm text-primary hover:underline">กลับไปหน้าเข้าสู่ระบบ</Link>
        </div>
      </form>

      {termsOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/35 p-4" role="dialog" aria-modal="true" aria-labelledby="terms-title">
          <button type="button" aria-label="ปิดข้อตกลง" onClick={() => setTermsOpen(false)} className="absolute inset-0" />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-xl">
            <button type="button" onClick={() => setTermsOpen(false)} aria-label="ปิด" className="absolute top-4 right-4 cursor-pointer text-muted-foreground hover:text-foreground">
              <X className="size-5" />
            </button>
            <h2 id="terms-title" className="pr-8 text-lg font-semibold text-foreground">ข้อตกลงและเงื่อนไขการใช้และบริการเว็บไซต์ Readji.com</h2>
            <div className="min-h-[200px]" />
          </div>
        </div>
      )}
    </>
  )
}
