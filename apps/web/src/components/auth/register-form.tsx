'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v3'
import { Lock, Phone } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { IconInput, PasswordInput } from './form-inputs'
import { PasswordStrengthIndicator } from './password-strength-indicator'
import { TurnstileWidget } from './turnstile-widget'
import { PhoneVerificationDialog } from './phone-verification-dialog'
import {
  registerWithPassword,
  requestRegistrationPhoneVerification,
  startRegistrationPhoneVerification,
  verifyRegistrationPhoneVerification,
} from '@/controllers/auth.controller'
import { ApiError } from '@/lib/api-client'
import { getApiUrl } from '@/site.config'

const registerSchema = z
  .object({
    u_name: z
      .string()
      .min(3, 'ชื่อผู้ใช้งานต้องมีอย่างน้อย 3 ตัวอักษร')
      .max(30, 'ชื่อผู้ใช้งานต้องไม่เกิน 30 ตัวอักษร'),
    email: z.string().email('อีเมลไม่ถูกต้อง'),
    phone_number: z.string().regex(/^0[689][0-9]{8}$/, 'กรุณากรอกเบอร์มือถือไทย 10 หลัก'),
    password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร').max(72),
    password_confirm: z.string(),
    terms: z.boolean().refine(Boolean, 'กรุณายอมรับข้อตกลงและเงื่อนไขการใช้บริการ'),
  })
  .refine((data) => data.password === data.password_confirm, {
    message: 'รหัสผ่านไม่ตรงกัน',
    path: ['password_confirm'],
  })

type RegisterValues = z.infer<typeof registerSchema>

type WebsiteAgreement = {
  id: string
  version: number
  content_html: string
}

export function RegisterForm() {
  const [termsOpen, setTermsOpen] = useState(false)
  const [websiteAgreement, setWebsiteAgreement] = useState<WebsiteAgreement | null>(null)
  const [isLoadingAgreement, setIsLoadingAgreement] = useState(true)
  const [agreementError, setAgreementError] = useState<string | null>(null)
  const [otpDialogOpen, setOtpDialogOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileKey, setTurnstileKey] = useState(0)
  const [verificationId, setVerificationId] = useState<string | null>(null)
  const [pendingRegistration, setPendingRegistration] = useState<RegisterValues | null>(null)
  const [isSending, setIsSending] = useState(false)
  const turnstileRequired = process.env.NODE_ENV !== 'development'
  const {
    control,
    register,
    handleSubmit,
    setValue,
    trigger,
    watch,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: { terms: false } })
  const phoneNumber = watch('phone_number')
  const password = watch('password')
  const termsAccepted = watch('terms')

  useEffect(() => {
    const controller = new AbortController()

    void fetch(getApiUrl('/agreements/website'), {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('ไม่สามารถโหลดข้อตกลงและเงื่อนไขได้')
        const body = await response.json() as { agreement: WebsiteAgreement | null }
        if (!controller.signal.aborted) {
          setWebsiteAgreement(body.agreement)
          setAgreementError(null)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setWebsiteAgreement(null)
          setAgreementError('ไม่สามารถโหลดข้อตกลงและเงื่อนไขได้')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingAgreement(false)
      })

    return () => controller.abort()
  }, [])

  function resetOtp() {
    setVerificationId(null)
    setOtpDialogOpen(false)
  }

  function fillMockRegistration() {
    const suffix = Date.now().toString().slice(-6)
    setValue('u_name', `demo_${suffix}`, { shouldValidate: true })
    setValue('email', `demo.${suffix}@example.test`, { shouldValidate: true })
    setValue('phone_number', '0900000000', { shouldValidate: true })
    setValue('password', 'DemoPass123!', { shouldValidate: true })
    setValue('password_confirm', 'DemoPass123!', { shouldValidate: true })
    setValue('terms', true, { shouldValidate: true })
    clearErrors()
    resetOtp()
  }

  async function startOtp(phone: string) {
    if (turnstileRequired && !turnstileToken) {
      setError('root', { message: 'กรุณายืนยัน Cloudflare Turnstile ก่อนสมัครสมาชิก' })
      return
    }
    setIsSending(true)
    clearErrors('root')
    try {
      const result = await startRegistrationPhoneVerification(phone, turnstileToken ?? undefined)
      setVerificationId(result.verification_id)
      setOtpDialogOpen(true)
    } catch (error) {
      setError('phone_number', { message: error instanceof ApiError ? error.message : 'ไม่สามารถส่งรหัส OTP ได้' })
    } finally {
      setTurnstileToken(null)
      setTurnstileKey((value) => value + 1)
      setIsSending(false)
    }
  }

  async function onSubmit(values: RegisterValues) {
    setSuccessMessage('')
    setPendingRegistration(values)
    await startOtp(values.phone_number)
  }

  async function registerWithGoogle() {
    if (!(await trigger('terms'))) return
    window.location.assign(getApiUrl('/auth/google/register'))
  }

  async function requestDialogOtp(phone: string, token: string | undefined) {
    const result = await requestRegistrationPhoneVerification(phone, token)
    setVerificationId(result.verification_id)
  }

  async function verifyDialogOtp(_phone: string, otp: string) {
    if (!verificationId || !pendingRegistration) throw new Error('ไม่พบคำขอยืนยันเบอร์มือถือ')
    const result = await verifyRegistrationPhoneVerification(verificationId, otp)
    const registration = await registerWithPassword({
      username: pendingRegistration.u_name,
      email: pendingRegistration.email,
      password: pendingRegistration.password,
      registration_phone_verification_id: verificationId,
      registration_phone_verification_token: result.verification_token,
    })
    setOtpDialogOpen(false)
    setSuccessMessage(registration.message)
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" aria-busy={isSubmitting || isSending}>
        {process.env.NODE_ENV === 'development' && (
          <div className="flex justify-end gap-3 text-xs">
            <button type="button" onClick={fillMockRegistration} className="text-muted-foreground underline underline-offset-2 hover:text-foreground">กรอกข้อมูลตัวอย่าง</button>
            <button type="button" onClick={() => setOtpDialogOpen(true)} className="text-muted-foreground underline underline-offset-2 hover:text-foreground">ดูตัวอย่าง Dialog OTP</button>
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium">ชื่อผู้ใช้งาน</label>
          <IconInput autoComplete="username" {...register('u_name')} />
          {errors.u_name && <p className="mt-1 text-xs text-destructive">{errors.u_name.message}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">อีเมล</label>
          <IconInput type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">เบอร์มือถือ</label>
          <IconInput
            icon={<Phone className="size-4" />}
            placeholder="0812345678"
            inputMode="tel"
            autoComplete="tel"
            {...register('phone_number', { onChange: resetOtp })}
          />
          {errors.phone_number && <p className="mt-1 text-xs text-destructive">{errors.phone_number.message}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">รหัสผ่าน</label>
          <PasswordInput icon={<Lock className="size-4" />} autoComplete="new-password" {...register('password')} />
          <PasswordStrengthIndicator password={password} />
          {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">ยืนยันรหัสผ่าน</label>
          <PasswordInput
            icon={<Lock className="size-4" />}
            autoComplete="new-password"
            {...register('password_confirm')}
          />
          {errors.password_confirm && (
            <p className="mt-1 text-xs text-destructive">{errors.password_confirm.message}</p>
          )}
        </div>
        <div className="flex items-center justify-center gap-1.5 text-sm">
          <Controller
            name="terms"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="accept-terms"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
            )}
          />
          <span>ยอมรับ</span>
          <button type="button" onClick={() => setTermsOpen(true)} className="text-blue-600 underline">
            ข้อตกลงและเงื่อนไข
          </button>
        </div>
        {errors.terms && <p className="-mt-2 text-center text-xs text-destructive">{errors.terms.message}</p>}
        <TurnstileWidget key={turnstileKey} action="register" onTokenChange={setTurnstileToken} />
        <button
          type="submit"
          disabled={!termsAccepted || isSubmitting || isSending || (turnstileRequired && !turnstileToken)}
          className="h-11 w-full rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground disabled:opacity-60"
        >
          {isSending ? 'กำลังส่ง OTP...' : 'สมัครสมาชิก'}
        </button>
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">หรือ</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <button
          type="button"
          onClick={() => void registerWithGoogle()}
          disabled={!termsAccepted}
          className="h-11 w-full rounded-lg border border-border bg-background px-4 text-base font-medium hover:bg-muted disabled:opacity-60"
        >
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
          <Link href="/login" className="text-sm text-primary hover:underline">
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </form>
      <PhoneVerificationDialog
        open={otpDialogOpen}
        initialPhoneNumber={phoneNumber}
        initialOtpSent={Boolean(verificationId)}
        onOpenChange={setOtpDialogOpen}
        onRequestOtp={(phone, token) => requestDialogOtp(phone, token)}
        onVerifyOtp={verifyDialogOtp}
      />
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="max-h-[85vh] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>ข้อตกลงและเงื่อนไขการใช้บริการ</DialogTitle>
            <DialogDescription className="sr-only">
              รายละเอียดข้อตกลงและเงื่อนไขการใช้บริการของเว็บไซต์
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg border bg-background p-4 sm:p-6">
            {isLoadingAgreement ? (
              <div className="space-y-3" aria-label="กำลังโหลดข้อตกลงและเงื่อนไข">
                <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-4 w-full animate-pulse rounded bg-muted" />
                <div className="h-4 w-11/12 animate-pulse rounded bg-muted" />
                <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
              </div>
            ) : agreementError ? (
              <p className="py-10 text-center text-sm text-destructive">{agreementError}</p>
            ) : websiteAgreement ? (
              <div
                className="break-words text-sm leading-7 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-primary/35 [&_blockquote]:pl-4 [&_h1]:my-5 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:my-4 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:my-3 [&_h3]:text-lg [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
                dangerouslySetInnerHTML={{ __html: websiteAgreement.content_html }}
              />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                ยังไม่มีข้อตกลงและเงื่อนไขที่เปิดใช้งาน
              </p>
            )}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setTermsOpen(false)}
              className="h-10 rounded-lg bg-primary px-4 text-primary-foreground"
            >
              ปิด
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
