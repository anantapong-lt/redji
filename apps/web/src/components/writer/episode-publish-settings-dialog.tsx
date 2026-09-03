'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioRow } from './create-episode-dialog'
import { api } from '@/lib/api'

type TargetMode = 'range' | 'selected'
type PublishMode = 'now' | 'schedule'

// ปุ่มนาฬิกา "ตั้งเวลาเผยแพร่หลายตอน" — เผยแพร่ทันที หรือตั้งเวลาเผยแพร่ หลายตอนพร้อมกัน
// เลือกตอนได้ 2 แบบเหมือน episode-label-settings-dialog.tsx (ช่วงเลขตอน หรือ sync กับ
// checkbox ที่เลือกไว้ในตาราง) ตอนที่ยังไม่มีเนื้อหา/รูป จะถูกข้ามให้อัตโนมัติฝั่ง backend
export function EpisodePublishSettingsDialog({
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
  const [targetMode, setTargetMode] = useState<TargetMode>('range')
  const [startEpNo, setStartEpNo] = useState('')
  const [endEpNo, setEndEpNo] = useState('')
  const [publishMode, setPublishMode] = useState<PublishMode>('now')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // default ไปโหมด "ใช้ตอนที่ติ๊กเลือกไว้" เสมอ — เหตุผลเดียวกับ episode-label-settings-dialog.tsx
  // (โหมดช่วงถ้าไม่ได้ตั้งใจแก้จะ pre-fill เป็น "ทุกตอน" เผลอกดบันทึกกระทบทั้งเรื่องทันที)
  useEffect(() => {
    if (open) {
      setTargetMode('selected')
      setStartEpNo('0')
      setEndEpNo(String(latestEpNo ?? 0))
      setPublishMode('now')
      setScheduleDate('')
      setScheduleTime('')
      setError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function handleSubmit() {
    let body: Record<string, unknown>

    if (targetMode === 'selected') {
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

    let scheduleDatetime: string | undefined
    if (publishMode === 'schedule') {
      if (!scheduleDate || !scheduleTime) {
        setError('กรุณาเลือกวันเวลาที่จะเผยแพร่ให้มากกว่าวันเวลาปัจจุบัน')
        return
      }
      const dt = new Date(`${scheduleDate}T${scheduleTime}`)
      if (Number.isNaN(dt.getTime()) || dt.getTime() <= Date.now()) {
        setError('กรุณาเลือกวันเวลาที่จะเผยแพร่ให้มากกว่าวันเวลาปัจจุบัน')
        return
      }
      scheduleDatetime = dt.toISOString()
    }
    setError('')

    setSaving(true)
    try {
      const result = await api
        .patch<{ data: { updated_count: number; skipped_count: number } }>(
          `/writer/works/${workUuid}/episodes/bulk-publish`,
          { ...body, publish_status: publishMode, schedule_datetime: scheduleDatetime },
        )
        .then((res) => res.data)

      const suffix = result.skipped_count > 0 ? ` (ข้าม ${result.skipped_count} ตอนที่ยังไม่มีเนื้อหา)` : ''
      setOpen(false)
      if (targetMode === 'selected') onClearSelection()
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
            <Clock className="size-4" />
            ตั้งเวลาเผยแพร่หลายตอน
          </DialogTitle>
        </DialogHeader>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">เลือกตอน</label>
          <div className="mb-3 flex flex-col gap-2 rounded-lg border border-border p-3">
            <RadioRow selected={targetMode === 'range'} onSelect={() => setTargetMode('range')}>
              กำหนดช่วงเลขตอน
            </RadioRow>
            {targetMode === 'range' && (
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

            <RadioRow selected={targetMode === 'selected'} onSelect={() => setTargetMode('selected')}>
              ใช้ตอนที่ติ๊กเลือกไว้ในตาราง ({selectedEpIds.length} ตอน)
            </RadioRow>
            {targetMode === 'selected' && selectedEpIds.length === 0 && (
              <p className="ml-6 text-xs text-muted-foreground">ยังไม่ได้ติ๊กเลือกตอนไว้เลย — ปิดหน้าต่างนี้แล้วติ๊กเลือกในตารางก่อน</p>
            )}
          </div>

          <label className="mb-1.5 block text-sm font-medium text-foreground">การเผยแพร่</label>
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <RadioRow selected={publishMode === 'now'} onSelect={() => setPublishMode('now')}>
              เผยแพร่ทันที
            </RadioRow>
            <RadioRow selected={publishMode === 'schedule'} onSelect={() => setPublishMode('schedule')}>
              ตั้งเวลาเผยแพร่
            </RadioRow>
            {publishMode === 'schedule' && (
              <div className="ml-6 flex gap-2">
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">วันที่</label>
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">เวลา</label>
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none"
                  />
                </div>
              </div>
            )}
          </div>
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
