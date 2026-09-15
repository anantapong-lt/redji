'use client'

import { useRef, useState } from 'react'
import { CheckCircle2, MessageSquareText, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/components/auth/auth-provider'
import { requestPhoneVerification, verifyPhoneVerification } from '@/controllers/auth.controller'
import { ApiError } from '@/lib/api-client'

const THAI_MOBILE_PATTERN = /^0[689][0-9]{8}$/

function displayPhone(phone: string): string {
  return phone.startsWith('+66') ? `0${phone.slice(3)}` : phone
}

export function PhoneVerificationSection({
  phoneNumber,
  pendingPhoneNumber,
  verified,
  onRequested,
  onVerified,
}: {
  phoneNumber: string | null
  pendingPhoneNumber: string | null
  verified: boolean
  onRequested: (phoneNumber: string) => void
  onVerified: (phoneNumber: string) => void
}) {
  const { accessToken } = useAuth()
  const [phone, setPhone] = useState(() => displayPhone(pendingPhoneNumber ?? phoneNumber ?? ''))
  const [otp, setOtp] = useState('')
  const [phoneDialogOpen, setPhoneDialogOpen] = useState(false)
  const [otpDialogOpen, setOtpDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const otpInputs = useRef<Array<HTMLInputElement | null>>([])
  const pendingPhone = pendingPhoneNumber ?? (verified ? phoneNumber : null)

  function closePhoneDialog(open: boolean) {
    setPhoneDialogOpen(open)
    if (!open) setError(null)
  }

  function closeOtpDialog(open: boolean) {
    setOtpDialogOpen(open)
    if (!open) {
      setOtp('')
      setError(null)
    }
  }

  async function requestOtp() {
    if (!accessToken || isSending) return
    if (!THAI_MOBILE_PATTERN.test(phone)) {
      setError('กรุณากรอกเบอร์มือถือไทย 10 หลัก ที่ขึ้นต้นด้วย 06, 08 หรือ 09')
      return
    }
    setError(null)
    setIsSending(true)
    try {
      const result = await requestPhoneVerification(phone, accessToken)
      onRequested(`+66${phone.slice(1)}`)
      setOtp('')
      setPhoneDialogOpen(false)
      setOtpDialogOpen(true)
      toast.success(result.message, { duration: 2500 })
      requestAnimationFrame(() => otpInputs.current[0]?.focus())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ไม่สามารถส่งรหัส OTP ได้')
    } finally {
      setIsSending(false)
    }
  }

  function applyOtp(start: number, value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6 - start)
    const next = otp.padEnd(6, ' ').split('')
    if (!digits) {
      next[start] = ' '
      setOtp(next.join('').trimEnd())
      return
    }
    digits.split('').forEach((digit, offset) => { next[start + offset] = digit })
    setOtp(next.join('').trimEnd())
    requestAnimationFrame(() => otpInputs.current[Math.min(start + digits.length, 5)]?.focus())
  }

  async function verifyOtp() {
    if (!accessToken || !pendingPhone || otp.length !== 6 || isVerifying) return
    setError(null)
    setIsVerifying(true)
    try {
      const result = await verifyPhoneVerification({ phone_number: displayPhone(pendingPhone), otp }, accessToken)
      onVerified(result.phone_number)
      setOtpDialogOpen(false)
      setOtp('')
      toast.success(result.message, { duration: 2500 })
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'ไม่สามารถยืนยันรหัส OTP ได้')
    } finally {
      setIsVerifying(false)
    }
  }

  if (phoneNumber && verified) {
    return (
      <section aria-label="เบอร์มือถือ" className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Phone className="size-5 text-muted-foreground" /></span>
        <div className="min-w-0 flex-1"><h3 className="font-bold">เบอร์มือถือ</h3><p className="text-sm text-muted-foreground">{displayPhone(phoneNumber)}</p></div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"><CheckCircle2 className="size-3.5" />ยืนยันแล้ว</span>
      </section>
    )
  }

  return (
    <section aria-labelledby="phone-verification-heading" className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Phone className="size-5 text-muted-foreground" /></span><div><h2 id="phone-verification-heading" className="font-bold">เบอร์มือถือ</h2><p className="text-sm text-muted-foreground">{pendingPhone ? `${displayPhone(pendingPhone)} · รอการยืนยัน` : 'ยังไม่ได้เพิ่มเบอร์มือถือ'}</p></div></div>
        {pendingPhone ? <Button type="button" onClick={() => { setError(null); setOtpDialogOpen(true); requestAnimationFrame(() => otpInputs.current[0]?.focus()) }} className="self-start sm:self-auto">ยืนยันเบอร์</Button> : <Button type="button" onClick={() => { setError(null); setPhoneDialogOpen(true) }} className="self-start sm:self-auto"><Phone className="size-4" />เพิ่มเบอร์มือถือ</Button>}
      </div>

      <Dialog open={phoneDialogOpen} onOpenChange={closePhoneDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>เพิ่มเบอร์มือถือ</DialogTitle><DialogDescription>รองรับเฉพาะเบอร์มือถือไทยที่ขึ้นต้นด้วย 06, 08 หรือ 09</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Input value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="tel" autoComplete="tel-national" placeholder="เช่น 0812345678" maxLength={10} disabled={isSending} aria-invalid={Boolean(error)} className="h-11" />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter><Button type="button" variant="outline" disabled={isSending} onClick={() => closePhoneDialog(false)}>ยกเลิก</Button><Button type="button" disabled={isSending || !phone} onClick={() => void requestOtp()}>{isSending ? 'กำลังส่ง...' : 'ส่ง OTP'}</Button></DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={otpDialogOpen} onOpenChange={closeOtpDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>กรอกรหัส OTP</DialogTitle><DialogDescription>กรอกรหัส 6 หลักที่ได้รับเพื่อยืนยันเบอร์มือถือ</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl bg-muted/60 p-4"><p className="flex items-center gap-2 text-sm text-muted-foreground"><MessageSquareText className="size-4" />ส่ง OTP ไปที่</p><p className="mt-1 font-semibold">{pendingPhone && displayPhone(pendingPhone)}</p><p className="mt-1 text-xs text-muted-foreground">สำหรับการทดสอบ ใช้รหัส <span className="font-medium text-foreground">123456</span></p></div>
            <div><p id="otp-label" className="mb-2 text-sm font-medium">กรอกรหัส OTP 6 หลัก</p><div role="group" aria-labelledby="otp-label" className="flex gap-2 sm:gap-3">{Array.from({ length: 6 }, (_, index) => <Input key={index} ref={(element) => { otpInputs.current[index] = element }} value={otp[index] ?? ''} onChange={(event) => applyOtp(index, event.target.value)} onPaste={(event) => { event.preventDefault(); applyOtp(index, event.clipboardData.getData('text')) }} onKeyDown={(event) => { if (event.key === 'Backspace' && !otp[index] && index > 0) otpInputs.current[index - 1]?.focus() }} inputMode="numeric" autoComplete={index === 0 ? 'one-time-code' : 'off'} pattern="[0-9]*" maxLength={6} disabled={isVerifying} aria-label={`หลักที่ ${index + 1}`} className="h-12 min-w-0 flex-1 px-0 text-center text-lg font-semibold" />)}</div></div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <DialogFooter><Button type="button" variant="outline" disabled={isVerifying} onClick={() => { closeOtpDialog(false); setPhoneDialogOpen(true) }}>เปลี่ยนเบอร์</Button><Button type="button" disabled={isVerifying || otp.length !== 6} onClick={() => void verifyOtp()}>{isVerifying ? 'กำลังยืนยัน...' : 'ยืนยัน OTP'}</Button></DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
