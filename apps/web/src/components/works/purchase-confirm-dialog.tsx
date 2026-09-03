'use client'

/**
 * components/works/purchase-confirm-dialog.tsx — ยืนยันซื้อตอนก่อนอ่าน (2026-08-05, ใหม่)
 *
 * user ขอ: "เวลากดตอนถัดไปหรือเปลี่ยนตอนผ่านช่อง...ควรจะเป็นการเปลี่ยนตอนต้องให้มันขึ้นหน้าต่าง
 * มาให้ซื้อด้วย แบบว่า 'แน่ใจใช่ไหมว่าจะซื้อเรื่อง...ตอนที่...' แล้วก็มีตกลง กับยกเลิก มีให้ติ๊กว่า
 * ไม่ต้องถามอีก 7 วันด้วยเผื่อใครรำคาญ" — โชว์เมื่อ episode-reader-client.tsx เจอ error
 * PURCHASE_REQUIRED ไม่ว่าจะเข้ามาทางไหน (ปุ่มตอนถัดไป/dropdown/สารบัญ/ลิงก์ตรง) เพราะทุกทาง
 * ชนกับ error state เดียวกันอยู่แล้ว ไม่ต้องดักทีละจุด
 */

import { useState } from 'react'
import { Coins } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatEpisodeTitle } from '@/lib/episode-format'

export function PurchaseConfirmDialog({
  open,
  workTitle,
  epNo,
  epLabel,
  epName,
  price,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean
  workTitle: string
  epNo: number
  epLabel: string | null
  epName: string
  price: number
  busy: boolean
  error: string | null
  onConfirm: (skipFor7Days: boolean) => void
  onCancel: () => void
}) {
  const [skip, setSkip] = useState(false)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>ยืนยันการซื้อตอน</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-foreground">
          แน่ใจใช่ไหมว่าจะซื้อเรื่อง <span className="font-medium">{workTitle}</span>{' '}
          {formatEpisodeTitle(epNo, epLabel, epName)} ?
        </p>

        <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-500">
          <Coins className="size-4" />
          ราคา {price.toLocaleString()} เหรียญ
        </p>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={skip}
            onChange={(e) => setSkip(e.target.checked)}
            className="size-4 cursor-pointer accent-primary"
          />
          ไม่ต้องถามอีก 7 วัน
        </label>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            ยกเลิก
          </Button>
          <Button type="button" onClick={() => onConfirm(skip)} disabled={busy}>
            {busy ? 'กำลังซื้อ...' : 'ตกลง'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
