'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lock, X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { IconInput, PasswordInput } from './form-inputs'
import { PasswordStrengthIndicator } from './password-strength-indicator'
import { TurnstileWidget } from './turnstile-widget'
import { registerWithPassword } from '@/controllers/auth.controller'
import { ApiError } from '@/lib/api-client'
import { SITE_CONFIG } from '@/site.config'

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
  const [successMessage, setSuccessMessage] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileKey, setTurnstileKey] = useState(0)
  const turnstileRequired = process.env.NODE_ENV !== 'development'
  const {
    control,
    register,
    handleSubmit,
    getValues,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { terms: false },
  })
  const password = watch('password')

  async function onSubmit(values: RegisterValues) {
    setSuccessMessage('')

    if (turnstileRequired && !turnstileToken) {
      setError('root', { message: 'กรุณายืนยัน Cloudflare Turnstile' })
      return
    }

    try {
      const result = await registerWithPassword({
        username: values.u_name,
        email: values.email,
        password: values.password,
        ...(turnstileToken ? { turnstile_token: turnstileToken } : {}),
      })
      setSuccessMessage(result.message)
    } catch (error) {
      if (error instanceof ApiError && error.field === 'email') {
        setError('email', { message: error.message })
      } else if (error instanceof ApiError && error.field === 'username') {
        setError('u_name', { message: error.message })
      } else {
        setError('root', {
          message: error instanceof ApiError
            ? error.message
            : 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        })
      }
    } finally {
      setTurnstileToken(null)
      setTurnstileKey((current) => current + 1)
    }
  }

  function registerWithGoogle() {
    if (!getValues('terms')) {
      setError('terms', { message: 'กรุณายอมรับข้อตกลงและเงื่อนไขการใช้และบริการ' })
      return
    }
    window.location.assign(new URL('/auth/google/register', SITE_CONFIG.apiUrl).toString())
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" aria-busy={isSubmitting}>
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
          <PasswordStrengthIndicator password={password} />
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

        <TurnstileWidget
          key={turnstileKey}
          action="register"
          onTokenChange={setTurnstileToken}
        />

        <button
          type="submit"
          disabled={isSubmitting || (turnstileRequired && !turnstileToken)}
          className="h-11 w-full cursor-pointer rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิก'}
        </button>

        <div className="flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">หรือ</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={registerWithGoogle}
          className="flex h-11 w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-border bg-background px-4 text-base font-medium text-foreground transition-colors hover:bg-muted"
        >
          <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.39 13.86A6 6 0 0 1 6.07 12c0-.65.11-1.28.32-1.86V7.52H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.48l3.35-2.62Z" />
            <path fill="#EA4335" d="M12 6.01c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.62C7.18 7.77 9.39 6.01 12 6.01Z" />
          </svg>
          สมัครสมาชิกด้วย Google
        </button>

        {errors.root?.message && (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
            {errors.root.message}
          </p>
        )}

        {successMessage && (
          <p role="status" className="rounded-lg bg-primary/10 px-3 py-2 text-center text-sm text-primary">
            {successMessage}
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
