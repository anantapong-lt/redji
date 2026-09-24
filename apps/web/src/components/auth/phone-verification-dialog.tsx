'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TurnstileWidget } from './turnstile-widget'
import { ApiError } from '@/lib/api-client'
import { Button } from '@/components/ui/button'

const OTP_RESEND_DELAY_MS = 5 * 60 * 1000

interface PhoneVerificationDialogProps {
  open: boolean
  required?: boolean
  initialPhoneNumber?: string
  initialOtpSent?: boolean
  initialOtpSentAt?: number
  onOpenChange?: (open: boolean) => void
  onRequestOtp: (phoneNumber: string, turnstileToken: string | undefined, isResend: boolean) => Promise<void>
  onVerifyOtp: (phoneNumber: string, otp: string) => Promise<void>
}

export function PhoneVerificationDialog({
  open,
  required = false,
  initialPhoneNumber = '',
  initialOtpSent = false,
  initialOtpSentAt = 0,
  onOpenChange,
  onRequestOtp,
  onVerifyOtp,
}: PhoneVerificationDialogProps) {
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber)
  const [otpSent, setOtpSent] = useState(initialOtpSent)
  const [otp, setOtp] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileKey, setTurnstileKey] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [otpSentAt, setOtpSentAt] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const resendAvailableAt = Math.max(otpSentAt, initialOtpSentAt) + OTP_RESEND_DELAY_MS
  const resendSeconds = Math.max(0, Math.ceil((resendAvailableAt - now) / 1000))
  const resendCountdown = `${Math.floor(resendSeconds / 60).toString().padStart(2, '0')}:${(resendSeconds % 60).toString().padStart(2, '0')}`
  const otpInputs = useRef<Array<HTMLInputElement | null>>([])
  const turnstileRequired = process.env.NODE_ENV !== 'development'

  useEffect(() => {
    const updateNow = () => setNow(Date.now())
    updateNow()
    if (!open || resendAvailableAt <= Date.now()) return
    const interval = window.setInterval(() => {
      updateNow()
      if (Date.now() >= resendAvailableAt) window.clearInterval(interval)
    }, 1000)
    window.addEventListener('focus', updateNow)
    document.addEventListener('visibilitychange', updateNow)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', updateNow)
      document.removeEventListener('visibilitychange', updateNow)
    }
  }, [open, resendAvailableAt])

  useEffect(() => {
    if (!open) return
    setPhoneNumber(initialPhoneNumber)
    setOtpSent(initialOtpSent)
    setOtp('')
    setError(null)
  }, [initialOtpSent, initialPhoneNumber, open])

  function changeOpen(nextOpen: boolean) {
    if (required && !nextOpen) return
    onOpenChange?.(nextOpen)
  }

  function applyOtp(index: number, value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6 - index)
    const next = otp.padEnd(6, ' ').split('')
    digits.split('').forEach((digit, offset) => { next[index + offset] = digit })
    setOtp(next.join('').trimEnd())
    requestAnimationFrame(() => otpInputs.current[Math.min(index + digits.length, 5)]?.focus())
  }

  async function requestOtp(isResend: boolean) {
    if (isSending || isVerifying || Date.now() < resendAvailableAt) return
    if (!/^0[689][0-9]{8}$/.test(phoneNumber)) {
      setError('กรุณากรอกเบอร์มือถือไทย 10 หลัก')
      return
    }
    if (turnstileRequired && !turnstileToken) {
      setError('กรุณายืนยัน Cloudflare Turnstile ก่อนขอรหัส OTP')
      return
    }
    setIsSending(true)
    setError(null)
    try {
      await onRequestOtp(phoneNumber, turnstileToken ?? undefined, isResend)
      const sentAt = Date.now()
      setOtpSentAt(sentAt)
      setNow(sentAt)
      setOtpSent(true)
      setOtp('')
      requestAnimationFrame(() => otpInputs.current[0]?.focus())
    } catch (cause) {
      setError(cause instanceof ApiError || cause instanceof Error ? cause.message : 'ไม่สามารถส่งรหัส OTP ได้')
    } finally {
      setTurnstileToken(null)
      setTurnstileKey((value) => value + 1)
      setIsSending(false)
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6) return
    setIsVerifying(true)
    setError(null)
    try {
      await onVerifyOtp(phoneNumber, otp)
    } catch (cause) {
      setError(cause instanceof ApiError || cause instanceof Error ? cause.message : 'ไม่สามารถยืนยันรหัส OTP ได้')
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        showCloseButton={false}
        className="max-w-md gap-0 overflow-hidden p-0"
        onEscapeKeyDown={(event) => { if (required) event.preventDefault() }}
        onPointerDownOutside={(event) => { if (required) event.preventDefault() }}
        onInteractOutside={(event) => { if (required) event.preventDefault() }}
      >
        <DialogHeader className="border-b bg-muted/30 px-6 pt-6 pb-5 text-left">
          <DialogTitle className="text-xl">ยืนยันเบอร์มือถือ</DialogTitle>
          <DialogDescription className="mt-1.5">
            {otpSent ? <>เราได้ส่งรหัสยืนยัน 6 หลักไปที่ <span className="font-medium text-foreground">{phoneNumber}</span></> : 'กรอกเบอร์มือถือเพื่อรักษาความปลอดภัยของบัญชีและรับรหัส OTP'}
          </DialogDescription>
        </DialogHeader>

        {!otpSent ? (
          <div className="space-y-4 px-6 py-5">
            <div><label htmlFor="verification-phone" className="mb-2 block text-sm font-medium">เบอร์มือถือ</label><input id="verification-phone" value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="tel" autoComplete="tel" placeholder="0812345678" className="h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></div>
            <TurnstileWidget key={turnstileKey} action="phone_verification" onTokenChange={setTurnstileToken} />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <button type="button" onClick={() => void requestOtp(false)} disabled={isSending || !phoneNumber || (turnstileRequired && !turnstileToken)} className="h-11 w-full rounded-lg bg-primary px-4 font-medium text-primary-foreground disabled:opacity-60">{isSending ? 'กำลังส่ง...' : 'ส่งรหัส OTP'}</button>
          </div>
        ) : (
          <>
            <div className="space-y-5 px-6 py-5">
              <div><p id="shared-otp-label" className="mb-2 text-sm font-medium">รหัสยืนยัน</p><div role="group" aria-labelledby="shared-otp-label" className="grid grid-cols-6 gap-2">{Array.from({ length: 6 }, (_, index) => <input key={index} ref={(element) => { otpInputs.current[index] = element }} value={otp[index] ?? ''} onChange={(event) => applyOtp(index, event.target.value)} onPaste={(event) => { event.preventDefault(); applyOtp(index, event.clipboardData.getData('text')) }} onKeyDown={(event) => { if (event.key === 'Backspace' && !otp[index] && index > 0) otpInputs.current[index - 1]?.focus() }} inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} maxLength={6} disabled={isVerifying} aria-label={`หลักที่ ${index + 1}`} className="h-12 w-full min-w-0 rounded-lg border border-input bg-background px-0 text-center text-lg font-semibold tabular-nums shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60" />)}</div><p className="mt-2 text-center text-xs text-muted-foreground">รหัสมีอายุ 5 นาที และใช้ได้เพียงครั้งเดียว</p></div>
              {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
            </div>
            <div className="border-t bg-muted/20 px-6 py-4"><p className="mb-2 text-sm font-medium">ยังไม่ได้รับรหัส?</p><TurnstileWidget key={turnstileKey} action="phone_verification" onTokenChange={setTurnstileToken} /><Button type="button" variant="outline" onClick={() => void requestOtp(true)} disabled={isSending || isVerifying || resendSeconds > 0 || (turnstileRequired && !turnstileToken)} className="h-10 w-full rounded-lg border-primary text-sm font-medium tabular-nums text-primary disabled:opacity-60">{isSending ? 'กำลังส่ง...' : resendSeconds > 0 ? `ขอรหัส OTP อีกครั้งใน ${resendCountdown}` : 'ขอรหัส OTP อีกครั้ง'}</Button></div>
            <DialogFooter className={`m-0 rounded-none border-t bg-background px-6 py-5 ${required ? 'sm:justify-end' : 'sm:justify-between'}`}>
              {!required && <button type="button" onClick={() => changeOpen(false)} disabled={isVerifying} className="h-10 rounded-lg border px-4">ยกเลิก</button>}
              <button type="button" onClick={() => void verifyOtp()} disabled={isVerifying || otp.length !== 6} className="h-10 rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-60">{isVerifying ? 'กำลังยืนยัน...' : 'ยืนยัน OTP'}</button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
