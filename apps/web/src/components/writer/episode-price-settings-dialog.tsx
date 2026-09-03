'use client'

import { useEffect, useState } from 'react'
import { Coins } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

// ปุ่มเหรียญ "ตั้งราคาหลายตอน" — ตั้งใจให้ง่ายกว่าปุ่มฟันเฟือง/นาฬิกา ตาม user ขอ
// เลือกได้แค่จาก checkbox ที่ตารางเลือกไว้เท่านั้น ไม่มีโหมดกำหนดช่วงเลขตอน
// กรอกตัวเลขราคาเดียว (0 = ฟรี) แล้วตั้งให้ทุกตอนที่เลือกพร้อมกัน
export function EpisodePriceSettingsDialog({
  workUuid,
  selectedEpIds,
  onUpdated,
  onClearSelection,
  trigger,
}: {
  workUuid: string
  selectedEpIds: string[]
  onUpdated: () => void
  onClearSelection: () => void
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [price, setPrice] = useState('0')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setPrice('0')
      setError('')
    }
  }, [open])

  async function handleSubmit() {
    if (selectedEpIds.length === 0) {
      setError('ยังไม่ได้เลือกตอนไว้เลย ปิดหน้าต่างนี้แล้วติ๊กเลือกตอนในตารางก่อน')
      return
    }
    const priceValue = Number(price)
    if (price.trim() === '' || Number.isNaN(priceValue) || priceValue < 0) {
      setError('กรุณาใส่ราคาเป็นตัวเลขตั้งแต่ 0 ขึ้นไป (0 = อ่านฟรี)')
      return
    }
    setError('')

    setSaving(true)
    try {
      const result = await api
        .patch<{ data: { updated_count: number } }>(`/writer/works/${workUuid}/episodes/bulk-price`, {
          ep_ids: selectedEpIds,
          ep_price: String(priceValue),
        })
        .then((res) => res.data)

      setOpen(false)
      onClearSelection()
      onUpdated()
    } catch (err: any) {
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="size-4" />
            ตั้งราคาหลายตอน
          </DialogTitle>
        </DialogHeader>

        <div>
          <p className="mb-3 text-sm text-muted-foreground">
            จะตั้งราคาให้ตอนที่ติ๊กเลือกไว้ในตาราง{' '}
            <span className="font-medium text-foreground">({selectedEpIds.length} ตอน)</span>
          </p>
          {selectedEpIds.length === 0 && (
            <p className="mb-3 text-xs text-destructive">ยังไม่ได้ติ๊กเลือกตอนไว้เลย — ปิดหน้าต่างนี้แล้วติ๊กเลือกในตารางก่อน</p>
          )}

          <label className="mb-1.5 block text-sm font-medium text-foreground">ราคา (เหรียญ)</label>
          <div className="flex items-center gap-2 rounded-lg border border-input px-3 py-2">
            <Coins className="size-4 shrink-0 text-amber-500" />
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => {
                setPrice(e.target.value)
                setError('')
              }}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">ใส่ 0 ถ้าอยากให้อ่านฟรี</p>
          {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-center gap-3">
          <Button type="button" variant="destructive" onClick={() => setOpen(false)} disabled={saving} className="rounded-full px-6">
            ยกเลิก
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving} className="rounded-full px-6">
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
