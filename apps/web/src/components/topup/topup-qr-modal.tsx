'use client'

/**
 * components/topup/topup-qr-modal.tsx — modal QR รอชำระเงิน (2026-08-06, ใหม่)
 *
 * ⚠️ โหมดทดสอบ (mock) — ยังไม่ได้ต่อ payment gateway จริง ดู comment ยาวที่ initiateTopup()
 * (apps/api/src/modules/topup/topup.service.ts) สำหรับรายละเอียดเต็มว่าของจริงควรเป็นยังไง
 *
 * QR ที่เห็นในนี้เจนจากสตริง mock (qr_code_data) ผ่านไลบรารี `qrcode` ฝั่ง client ล้วนๆ — ไม่ใช่
 * PromptPay payload จริง สแกนแล้วไม่มีเงินวิ่งไปไหน ปุ่ม "จำลองว่าจ่ายแล้ว" (โชว์เฉพาะ
 * non-production build — ดู IS_DEV) ยิง POST /topup/mock-confirm/:ref_id แทน webhook จริงจาก
 * gateway — endpoint นั้นถูกบล็อกไว้ที่ NODE_ENV=production ฝั่ง backend อีกชั้นด้วย (defense in
 * depth: ต่อให้ build frontend ผิดพลาดโชว์ปุ่มหลุดมา backend ก็ปฏิเสธอยู่ดี)
 *
 * poll สถานะทุก 2 วิ (pattern เดียวกับ auto-add-episode-dialog.tsx) จนกว่าจะ completed/failed/
 * cancelled — พอ completed เรียก updatePoints() ให้ยอดเหรียญที่มุมขวาบน (CoinBadge) อัปเดตทันที
 * โดยไม่ต้อง refresh หน้า (pattern เดียวกับหลังซื้อตอน — episode-reader-client.tsx) + invalidate
 * query ประวัติการเติมเหรียญด้วย ไม่งั้นตาราง "ประวัติการเติมเหรียญ" ท้ายหน้า /topup จะไม่โผล่
 * รายการที่เพิ่งสำเร็จจนกว่าจะ refresh หน้าเอง (เจอบั๊กนี้จริงตอนทดสอบ)
 */

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import type { TopupInitiateResponse, TopupStatusResponse } from '@/types'

const POLL_INTERVAL_MS = 2000
const IS_DEV = process.env.NODE_ENV !== 'production'

export function TopupQRModal({
  data,
  onClose,
}: {
  data: TopupInitiateResponse | null
  onClose: () => void
}) {
  const updatePoints = useAuthStore((s) => s.updatePoints)
  const queryClient = useQueryClient()
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [status, setStatus] = useState<TopupStatusResponse['status']>('pending')
  const [simulating, setSimulating] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => () => stopPolling(), [])

  useEffect(() => {
    if (!data) {
      setQrImage(null)
      setStatus('pending')
      stopPolling()
      return
    }

    QRCode.toDataURL(data.qr_code_data, { width: 240, margin: 1 }).then(setQrImage)

    async function checkStatus() {
      if (!data) return
      try {
        const res = await api.get<{ data: TopupStatusResponse }>(`/topup/status/${data.ref_id}`)
        setStatus(res.data.status)
        if (res.data.status === 'completed') {
          stopPolling()
          updatePoints(Number(res.data.point))
          queryClient.invalidateQueries({ queryKey: ['topup', 'history'] })
          toast.success('เติมเหรียญสำเร็จ!')
        } else if (res.data.status === 'failed' || res.data.status === 'cancelled') {
          stopPolling()
          queryClient.invalidateQueries({ queryKey: ['topup', 'history'] })
        }
      } catch {
        // เงียบไว้ — poll รอบถัดไปลองใหม่เอง ไม่ต้องโชว์ error รบกวนทุกครั้งที่พลาด 1 รอบ
      }
    }

    pollRef.current = setInterval(checkStatus, POLL_INTERVAL_MS)
    return () => stopPolling()
  }, [data?.ref_id])

  async function handleSimulatePaid() {
    if (!data) return
    setSimulating(true)
    try {
      await api.post(`/topup/mock-confirm/${data.ref_id}`)
      const res = await api.get<{ data: TopupStatusResponse }>(`/topup/status/${data.ref_id}`)
      setStatus(res.data.status)
      if (res.data.status === 'completed') {
        stopPolling()
        updatePoints(Number(res.data.point))
        queryClient.invalidateQueries({ queryKey: ['topup', 'history'] })
        toast.success('เติมเหรียญสำเร็จ!')
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'จำลองการจ่ายเงินไม่สำเร็จ')
    } finally {
      setSimulating(false)
    }
  }

  return (
    <Dialog open={Boolean(data)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>สแกนเพื่อชำระเงิน</DialogTitle>
        </DialogHeader>

        {data && (
          <div className="flex flex-col items-center gap-4">
            {data.is_mock && (
              <p className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                โหมดทดสอบ — ไม่ใช่การชำระเงินจริง
              </p>
            )}

            {status === 'completed' ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <CheckCircle2 className="size-16 text-emerald-500" />
                <p className="text-lg font-bold text-foreground">เติมเหรียญสำเร็จ</p>
                <p className="text-sm text-muted-foreground">ได้รับ {Number(data.coins).toLocaleString()} เหรียญ</p>
              </div>
            ) : (
              <>
                {qrImage && (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL จาก qrcode lib เจนสดฝั่ง client ใช้ next/image ไม่ได้
                  <img src={qrImage} alt="QR Code" className="size-56 rounded-lg border border-border" />
                )}
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{Number(data.amount).toLocaleString()} ฿</p>
                  <p className="text-xs text-muted-foreground">อ้างอิง {data.ref_id}</p>
                </div>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  รอการชำระเงิน...
                </p>
                {IS_DEV && (
                  <Button variant="outline" className="w-full" disabled={simulating} onClick={handleSimulatePaid}>
                    {simulating ? 'กำลังจำลอง...' : '(โหมดทดสอบ) จำลองว่าจ่ายแล้ว'}
                  </Button>
                )}
              </>
            )}

            <Button variant="ghost" className="w-full" onClick={onClose}>
              {status === 'completed' ? 'ปิด' : 'ยกเลิก'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
