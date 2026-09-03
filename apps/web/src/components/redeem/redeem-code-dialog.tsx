'use client'

/**
 * components/redeem/redeem-code-dialog.tsx — ป็อปอัพ "ใช้โค้ด" (2026-08-18, ใหม่)
 *
 * เปิดจากปุ่ม "ใช้โค้ด" ในเนวบาร์ (ดู navbar/redeem-code-menu-item.tsx) — ไม่ใช่หน้าแยกอย่างที่
 * ลิงก์เดิม (/redeem-code) เคยชี้ไปแบบ dead link เพราะ user ขอให้เป็น "หน้าต่างเด้งขึ้นมา" ตรงๆ
 *
 * รองรับ 3 ประเภทผลลัพธ์จาก POST /redeem-codes/redeem:
 * - instant_coins / referral: บวกเหรียญเข้าบัญชีทันที — sync เข้า auth store (updatePoints) ให้
 *   navbar เห็นยอดใหม่ทันทีไม่ต้อง reload
 * - topup_bonus_percent: เปิดสิทธิ์โบนัส % รอเติมเงินครั้งถัดไป — invalidate active-bonus query
 *   ให้ปุ่ม "ใช้โค้ด" ขึ้น highlight ทันที
 *
 * ถ้ามาจากลิงก์เชิญ (?ref=CODE, ดู lib/referral-code.ts) จะ prefill โค้ดให้อัตโนมัติตอนเปิด —
 * เคลียร์ค่าที่ prefill ไว้ทิ้งทันทีที่แลกสำเร็จ (ไม่ว่าประเภทไหน) กันเผื่อ prefill ซ้ำครั้งหน้า
 */

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Gift, PartyPopper } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { getPendingReferralCode, clearPendingReferralCode } from '@/lib/referral-code'

type RedeemResult = {
  type: 'instant_coins' | 'referral'
  coins: number
  new_balance: string
} | {
  type: 'topup_bonus_percent'
  percent: number
  expires_at: string
}

function formatRemaining(expiresAt: string): string {
  const diffMs = new Date(expiresAt).getTime() - Date.now()
  if (diffMs <= 0) return 'หมดเวลาแล้ว'
  const totalHours = Math.floor(diffMs / (60 * 60 * 1000))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return days > 0 ? `${days} วัน ${hours} ชม.` : `${hours} ชม.`
}

export function RedeemCodeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<RedeemResult | null>(null)
  const queryClient = useQueryClient()

  function reset() {
    setCode('')
    setError('')
    setResult(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  // เปิด dialog แล้วช่องยังว่างอยู่ → prefill จากลิงก์เชิญที่เคยกดมา (ถ้ามี)
  useEffect(() => {
    if (open) {
      const pending = getPendingReferralCode()
      if (pending) setCode((prev) => prev || pending)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return

    setSubmitting(true)
    setError('')
    try {
      const res = await api.post<{ data: RedeemResult }>('/redeem-codes/redeem', { code: code.trim() })
      setResult(res.data)
      clearPendingReferralCode()

      if (res.data.type === 'instant_coins' || res.data.type === 'referral') {
        useAuthStore.getState().updatePoints(Number(res.data.new_balance))
      } else {
        queryClient.invalidateQueries({ queryKey: ['redeem-codes', 'active-bonus'] })
      }
    } catch (err: any) {
      setError(err?.message ?? 'แลกโค้ดไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="size-5" style={{ color: '#b79240' }} />
            ใช้โค้ด
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <PartyPopper className="size-10 text-amber-500" />
            {result.type === 'topup_bonus_percent' ? (
              <>
                <p className="text-lg font-bold text-foreground">เปิดใช้งานโบนัส +{result.percent}% แล้ว!</p>
                <p className="text-sm text-muted-foreground">
                  ใช้ได้กับการเติมเงินครั้งถัดไป — เหลือเวลาอีก {formatRemaining(result.expires_at)}
                </p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-foreground">ได้รับ {result.coins.toLocaleString()} เหรียญ!</p>
                <p className="text-sm text-muted-foreground">ยอดเหรียญปัจจุบัน {Number(result.new_balance).toLocaleString()}</p>
              </>
            )}
            <Button type="button" onClick={() => handleOpenChange(false)} className="mt-2 rounded-full px-6">
              ปิด
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value); setError('') }}
              placeholder="กรอกโค้ดที่นี่"
              maxLength={40}
              autoFocus
              className="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-center text-sm font-semibold tracking-wide uppercase outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {error && <p className="text-center text-xs text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting || !code.trim()} className="rounded-full">
              {submitting ? 'กำลังตรวจสอบ...' : 'ใช้โค้ด'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
