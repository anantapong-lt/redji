'use client'

import { useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioRow } from './create-episode-dialog'
import { api } from '@/lib/api'

type Mode = 'range' | 'selected'

// ปุ่มฟันเฟือง "ตั้งค่าพิเศษ" — ตอนนี้มีแค่ตั้งค่า "คำเรียกตอน" (migration 014, ค่าต่อตอน)
// แก้คำเรียกของหลายตอนพร้อมกันทีเดียว เลือกตอนได้ 2 แบบ:
//   - กำหนดช่วงเลขตอน (start-end) — ช่วงกว้างครอบถึงตอนล่าสุด = เหมือน "ตั้งค่าเริ่มต้นตั้งแต่นี้ไป"
//     (ตอนใหม่ที่สร้างต่อไปจะ inherit คำเรียกจากตอนล่าสุดเองอัตโนมัติอยู่แล้ว), ช่วงแคบ = แก้เฉพาะจุด
//   - sync กับ checkbox ที่เลือกไว้ในตาราง — เลือกตอนแบบไม่ต่อเนื่องกันได้ (เช่นตอน 3 กับตอน 9 เท่านั้น)
//     ถ้าเปิดมาแล้วมีตอนเลือกไว้อยู่แล้ว จะ default ไปโหมดนี้ให้เลย สลับกลับไปโหมดช่วงได้เสมอ
export function EpisodeLabelSettingsDialog({
  workUuid,
  latestEpNo,
  selectedEpIds,
  onUpdated,
  onClearSelection,
  trigger,
}: {
  workUuid: string
  latestEpNo: number | null
  selectedEpIds: string[]
  onUpdated: () => void
  onClearSelection: () => void
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('range')
  const [startEpNo, setStartEpNo] = useState('')
  const [endEpNo, setEndEpNo] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // เปิดหน้าต่าง — default ไปโหมด "ใช้ตอนที่ติ๊กเลือกไว้" เสมอ (ปลอดภัยกว่า — โหมดช่วงถ้า
  // ไม่ได้ตั้งใจแก้อะไรเลยจะ pre-fill เป็น 0 ถึงตอนล่าสุด ซึ่งคือ "ทุกตอน" เผลอกดบันทึกจะ
  // กระทบทุกตอนในเรื่องทันที ไม่ควรเป็นค่าเริ่มต้นที่กดยืนยันได้โดยไม่รู้ตัว)
  useEffect(() => {
    if (open) {
      setMode('selected')
      setStartEpNo('0')
      setEndEpNo(String(latestEpNo ?? 0))
      setLabel('')
      setError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function handleSubmit() {
    let body: Record<string, unknown>

    if (mode === 'selected') {
      if (selectedEpIds.length === 0) {
        setError('ยังไม่ได้เลือกตอนไว้เลย ติ๊กเลือกตอนในตารางก่อน')
        return
      }
      body = { ep_ids: selectedEpIds }
    } else {
      const start = Number(startEpNo)
      const end = Number(endEpNo)
      if (startEpNo.trim() === '' || !Number.isInteger(start) || start < 0) {
        setError('กรุณาใส่เลขตอนเริ่มต้นเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป')
        return
      }
      if (endEpNo.trim() === '' || !Number.isInteger(end) || end < start) {
        setError('เลขตอนสิ้นสุดต้องเป็นจำนวนเต็มและไม่น้อยกว่าเลขเริ่มต้น')
        return
      }
      body = { start_ep_no: start, end_ep_no: end }
    }
    setError('')

    setSaving(true)
    try {
      const result = await api
        .patch<{ data: { updated_count: number } }>(`/writer/works/${workUuid}/episodes/bulk-label`, {
          ...body,
          episode_label: label.trim() || null,
        })
        .then((res) => res.data)

      setOpen(false)
      if (mode === 'selected') onClearSelection()
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
            <Settings2 className="size-4" />
            ตั้งค่าพิเศษ
          </DialogTitle>
        </DialogHeader>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">คำเรียกตอน</label>
          <p className="mb-3 text-xs text-muted-foreground">ตั้งคำเรียกให้หลายตอนพร้อมกันทีเดียว เลือกตอนได้ 2 แบบ</p>

          <div className="mb-3 flex flex-col gap-2 rounded-lg border border-border p-3">
            <RadioRow selected={mode === 'range'} onSelect={() => setMode('range')}>
              กำหนดช่วงเลขตอน (ช่วงกว้างครอบถึงตอนล่าสุด = ตั้งเป็นค่าเริ่มต้นตั้งแต่นี้ไป)
            </RadioRow>
            {mode === 'range' && (
              <div className="ml-6 grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">ตั้งแต่ตอนที่</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={startEpNo}
                    onChange={(e) => {
                      setStartEpNo(e.target.value)
                      setError('')
                    }}
                    className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">ถึงตอนที่</label>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={endEpNo}
                    onChange={(e) => {
                      setEndEpNo(e.target.value)
                      setError('')
                    }}
                    className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>
              </div>
            )}

            <RadioRow selected={mode === 'selected'} onSelect={() => setMode('selected')}>
              ใช้ตอนที่ติ๊กเลือกไว้ในตาราง ({selectedEpIds.length} ตอน)
            </RadioRow>
            {mode === 'selected' && selectedEpIds.length === 0 && (
              <p className="ml-6 text-xs text-muted-foreground">ยังไม่ได้ติ๊กเลือกตอนไว้เลย — ปิดหน้าต่างนี้แล้วติ๊กเลือกในตารางก่อน</p>
            )}
          </div>
          {error && <p className="mb-3 text-xs text-destructive">{error}</p>}

          <label className="mb-1.5 block text-sm font-medium text-foreground">คำเรียกตอนใหม่</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="เช่น ตอนที่, บทที่ 4 ตอนที่ (เว้นว่างได้ถ้าไม่ต้องการ)"
            className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
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
