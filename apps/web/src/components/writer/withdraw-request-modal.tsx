'use client'

/**
 * components/writer/withdraw-request-modal.tsx — "แจ้งถอนเงิน" (2026-08-06, ใหม่)
 *
 * user ส่งภาพอ้างอิงมาเป็น wizard 3 ขั้นตอน (กรอกข้อมูล → ยืนยัน OTP → เสร็จสิ้น) แต่ขอให้ตัดขั้น
 * OTP ทิ้งไปเลย เหลือแค่ 2 ขั้น: "1 กรอกข้อมูล" → "2 ตรวจสอบ" — ข้อมูลที่กรอกในขั้น 1 จะ "ล็อค"
 * ไว้ในขั้น 2 (แสดงเป็น summary อ่านอย่างเดียว แก้ไม่ได้ ต้องกด "ย้อนกลับ" ถ้าจะแก้)
 *
 * บัญชีธนาคารที่โอนเข้าดึงจาก GET /writer/bank-info (บัญชีปัจจุบันที่ยืนยันแล้ว ล็อคแก้ไม่ได้ในนี้
 * — ต้องไปที่ปุ่ม "ขอเปลี่ยนข้อมูลธนาคาร" แยกต่างหากถ้าจะเปลี่ยน)
 *
 * ค่าธรรมเนียม (20 บาท หลังใช้สิทธิ์ฟรี 2 ครั้ง/เดือนหมด) พรีวิวจาก used_this_month ที่ได้จาก
 * GET /writer/withdrawals/overview — backend คำนวณจริงซ้ำอีกทีตอน submit เสมอ (พรีวิวนี้แค่ช่วย
 * ให้ user เห็นล่วงหน้า ไม่ใช่แหล่งความจริง)
 *
 * 2026-08-18: เช็คล่วงหน้าว่ามีการแก้ไขข้อมูลนักเขียน (/writer/info) ที่ยังรอตรวจสอบอยู่ไหม — ถ้ามี
 * บล็อกตั้งแต่ขั้น 1 เลย (เหมือน pattern !hasBankAccount ที่มีอยู่แล้ว) ไม่ต้องรอให้กด submit แล้ว
 * ค่อยเจอ error จาก backend (PENDING_INFO_EDIT ใน requestWithdrawal ก็ยังกันซ้ำไว้อยู่ดีถ้าหลุดมาถึง
 * ตรงนั้นจริง — คิวรีคีย์เดียวกับ hooks/use-writer-application.ts ตั้งใจ แชร์ cache ถ้าเคยเข้า
 * /writer/info มาก่อนในเซสชันนี้แล้ว ไม่ต้องยิงซ้ำ)
 */

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { getBankName } from '@/lib/thai-banks'

const MIN_AMOUNT = 500
const MAX_AMOUNT = 50000
const FREE_PER_MONTH = 2
const FEE_AMOUNT = 20

interface ApiBankInfo {
  bank_code: string | null
  account_name: string | null
  account_number: string | null
}

interface ApiWithdrawOverview {
  used_this_month: number
}

interface ApiWriterApplication {
  status: 'pending' | 'approve' | 'rejected'
}

function formatBaht(n: number): string {
  return `฿${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function WithdrawRequestModal({
  open,
  onOpenChange,
  availableBalance,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  availableBalance: number
  onSuccess: () => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [amountStr, setAmountStr] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const bankInfoQuery = useQuery({
    queryKey: ['writer', 'bank-info'],
    queryFn: () => api.get<{ data: ApiBankInfo }>('/writer/bank-info').then((r) => r.data),
    enabled: open,
  })

  const overviewQuery = useQuery({
    queryKey: ['writer', 'withdrawals', 'overview'],
    queryFn: () => api.get<{ data: ApiWithdrawOverview }>('/writer/withdrawals/overview').then((r) => r.data),
    enabled: open,
  })

  const applicationQuery = useQuery({
    queryKey: ['writer-application', 'me'],
    queryFn: () => api.get<{ data: ApiWriterApplication | null }>('/users/me/writer-application').then((r) => r.data),
    enabled: open,
  })
  const hasPendingInfoEdit = applicationQuery.data?.status === 'pending'

  useEffect(() => {
    if (open) {
      setStep(1)
      setAmountStr('')
      setError(null)
    }
  }, [open])

  const bankInfo = bankInfoQuery.data
  const hasBankAccount = Boolean(bankInfo?.bank_code)
  const usedThisMonth = overviewQuery.data?.used_this_month ?? 0
  const willChargeFee = usedThisMonth >= FREE_PER_MONTH

  const amount = Number(amountStr)
  const maxAllowed = Math.floor(Math.min(MAX_AMOUNT, availableBalance))
  const feeAmount = willChargeFee ? FEE_AMOUNT : 0
  const netAmount = Math.max(amount - feeAmount, 0)

  function handleMax() {
    setAmountStr(String(maxAllowed))
  }

  function handleNext() {
    if (hasPendingInfoEdit) {
      setError('มีการแก้ไขข้อมูลนักเขียนที่รอตรวจสอบอยู่ ไม่สามารถขอถอนเงินได้จนกว่าจะได้รับการยืนยัน')
      return
    }
    if (!hasBankAccount) {
      setError('ยังไม่มีบัญชีธนาคารที่ยืนยันแล้ว')
      return
    }
    if (!amountStr || Number.isNaN(amount)) {
      setError('กรุณากรอกจำนวนเงิน')
      return
    }
    if (amount < MIN_AMOUNT) {
      setError(`จำนวนเงินขั้นต่ำ ${MIN_AMOUNT.toLocaleString()} บาท`)
      return
    }
    if (amount > MAX_AMOUNT) {
      setError(`จำนวนเงินสูงสุด ${MAX_AMOUNT.toLocaleString()} บาทต่อครั้ง`)
      return
    }
    if (amount > availableBalance) {
      setError('ยอดเงินคงเหลือไม่พอสำหรับจำนวนที่ขอถอน')
      return
    }
    setError(null)
    setStep(2)
  }

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/writer/withdrawals', { amount })
      toast.success('ส่งคำขอถอนเงินสำเร็จ รอการตรวจสอบ')
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      setError(err?.message ?? 'ส่งคำขอไม่สำเร็จ')
      setStep(1)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>แจ้งถอนเงิน</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 text-xs">
          <span className={step === 1 ? 'font-bold text-primary' : 'text-muted-foreground'}>1. กรอกข้อมูล</span>
          <span className="text-muted-foreground">›</span>
          <span className={step === 2 ? 'font-bold text-primary' : 'text-muted-foreground'}>2. ตรวจสอบ</span>
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            {bankInfoQuery.isLoading || applicationQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
            ) : hasPendingInfoEdit ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                มีการแก้ไขข้อมูลนักเขียนที่รอทีมงานตรวจสอบอยู่ (ดูได้ที่หน้า &quot;ข้อมูลนักเขียน&quot;) จะขอถอนเงินได้อีกครั้งหลังได้รับการยืนยัน
              </p>
            ) : !hasBankAccount ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                ยังไม่มีบัญชีธนาคารที่ยืนยันแล้ว กรุณาส่งคำขอผูกบัญชีก่อนผ่านปุ่ม &quot;ขอเปลี่ยนข้อมูลธนาคาร&quot;
              </p>
            ) : (
              <>
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">โอนเข้าบัญชี</p>
                  <p className="font-medium text-foreground">{getBankName(bankInfo!.bank_code!)}</p>
                  <p className="text-sm text-muted-foreground">
                    {bankInfo!.account_name} · {bankInfo!.account_number}
                  </p>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">จำนวนเงินที่ต้องการถอน</label>
                    <button type="button" onClick={handleMax} className="cursor-pointer text-xs font-medium text-primary hover:underline">
                      ทั้งหมด
                    </button>
                  </div>
                  <Input
                    type="number"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    placeholder={`ขั้นต่ำ ${MIN_AMOUNT.toLocaleString()} - สูงสุด ${MAX_AMOUNT.toLocaleString()} บาท`}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">ยอดเงินคงเหลือ: {formatBaht(availableBalance)}</p>
                </div>

                <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  ถอนฟรี {FREE_PER_MONTH} ครั้ง/เดือน (ใช้ไปแล้ว {usedThisMonth}/{FREE_PER_MONTH} ครั้งในเดือนนี้)
                  เกินจากนั้นมีค่าธรรมเนียม {FEE_AMOUNT} บาท/ครั้ง — ระบบดำเนินการโอนเงินภายใน 3-7 วันทำการ
                </p>
              </>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-border p-3 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">จำนวนที่ขอถอน</span>
                <span className="text-foreground">{formatBaht(amount)}</span>
              </div>
              {feeAmount > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">ค่าดำเนินการ</span>
                  <span className="text-destructive">-{formatBaht(feeAmount)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t border-border pt-2 font-bold text-foreground">
                <span>ยอดที่จะได้รับ</span>
                <span>{formatBaht(netAmount)}</span>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p className="text-xs text-muted-foreground">โอนเข้าบัญชี</p>
              <p className="font-medium text-foreground">{getBankName(bankInfo!.bank_code!)}</p>
              <p className="text-muted-foreground">
                {bankInfo!.account_name} · {bankInfo!.account_number}
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              ระบบจะดำเนินการตรวจสอบและโอนเงินภายใน 3-7 วันทำการหลังส่งคำขอ
            </p>
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                ยกเลิก
              </Button>
              <Button onClick={handleNext} disabled={!hasBankAccount || hasPendingInfoEdit || bankInfoQuery.isLoading}>
                ดำเนินการต่อ
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>
                ย้อนกลับ
              </Button>
              <Button onClick={handleConfirm} disabled={submitting}>
                {submitting ? 'กำลังส่ง...' : 'ยืนยันถอนเงิน'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
