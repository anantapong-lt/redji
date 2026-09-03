'use client'

import { useEffect, useState } from 'react'
import type { JSONContent } from '@tiptap/react'
import { FilePlus2, HelpCircle, Coins } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from './rich-text-editor'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { formatEpisodeTitle } from '@/lib/episode-format'
import { tiptapToNovelBlocks } from '@/lib/novel-blocks'
import { BulkEpisodeUploadPanel } from './auto-add-episode-dialog'

const EP_NAME_MAX = 120
const READER_MESSAGE_MAX = 200

type PriceMode = 'free' | 'paid'
type PublishMode = 'hide' | 'now' | 'schedule'

export function RadioRow({
  selected,
  onSelect,
  children,
}: {
  selected: boolean
  onSelect: () => void
  children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onSelect} className="flex cursor-pointer items-center gap-2 text-left text-sm text-foreground">
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-full border-2',
          selected ? 'border-primary' : 'border-input',
        )}
      >
        {selected && <span className="size-2 rounded-full bg-primary" />}
      </span>
      {children}
    </button>
  )
}

export function CreateEpisodeDialog({
  workUuid,
  previousEpNo,
  totalEpisodes,
  isWorkCompleted,
  existingEpNos,
  latestEpisodeLabel,
  trigger,
  onCreated,
}: {
  workUuid: string
  previousEpNo: number | null
  totalEpisodes: number
  isWorkCompleted: boolean
  existingEpNos: number[]
  // migration 014 — คำเรียกตอนเป็นค่าต่อตอนแล้ว ค่านี้คือคำเรียกของ "ตอนล่าสุด" (ep_no สูงสุด)
  // เอามาเติมให้อัตโนมัติ (backend inherit ให้เองอยู่แล้วถ้าไม่ส่ง แต่เติมโชว์ในฟอร์มไว้ก่อนให้เห็น/แก้ได้)
  latestEpisodeLabel: string | null
  trigger: React.ReactNode
  onCreated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [creationMode, setCreationMode] = useState<'single' | 'bulk'>('single')
  const [epNo, setEpNo] = useState('')
  const [epLabel, setEpLabel] = useState('')
  const [epNoError, setEpNoError] = useState('')
  const [epName, setEpName] = useState('')
  const [content, setContent] = useState<JSONContent | undefined>(undefined)
  const [readerMessage, setReaderMessage] = useState('')
  const [priceMode, setPriceMode] = useState<PriceMode>('free')
  const [priceValue, setPriceValue] = useState('0')
  const [publishMode, setPublishMode] = useState<PublishMode>('now')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleError, setScheduleError] = useState('')
  const [saving, setSaving] = useState(false)
  // Tiptap เก็บ document ภายในตัวเอง ไม่ sync กับ prop content หลัง mount ครั้งแรก
  // ต้องเปลี่ยน key เพื่อบังคับ remount ถึงจะเคลียร์เนื้อหาเก่าจริง
  const [editorKey, setEditorKey] = useState(0)

  // เปิดหน้าต่าง — เสนอเลขลำดับตอนถัดไปให้อัตโนมัติ + จำ "คำเรียกตอน" จากตอนล่าสุดของเรื่องนี้มาเติมให้เลย
  // (ตาม decision ของ user: พิมพ์คำเรียกตอนแค่ครั้งเดียว ตอนต่อๆ ไปไม่ต้องพิมพ์ซ้ำ)
  useEffect(() => {
    if (open) {
      setEpNo(String(previousEpNo !== null ? previousEpNo + 1 : 0))
      setEpLabel(latestEpisodeLabel ?? '')
      setCreationMode('single')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ล้างฟอร์มทันทีที่ปิดหน้าต่าง (ไม่ว่าจะกดยกเลิก, ปิด, หรือบันทึกสำเร็จ)
  useEffect(() => {
    if (!open) {
      setEpName('')
      setContent(undefined)
      setReaderMessage('')
      setPriceMode('free')
      setPriceValue('0')
      setPublishMode('now')
      setScheduleDate('')
      setScheduleTime('')
      setScheduleError('')
      setEpNoError('')
      setEditorKey((k) => k + 1)
    }
  }, [open])

  async function handleSubmit() {
    const epNoValue = Number(epNo)
    if (epNo.trim() === '' || !Number.isInteger(epNoValue) || epNoValue < 0) {
      setEpNoError('กรุณาใส่เลขลำดับตอนเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป')
      return
    }
    if (existingEpNos.includes(epNoValue)) {
      setEpNoError('เลขลำดับตอนนี้ถูกใช้ไปแล้ว กรุณาเลือกเลขอื่น')
      return
    }
    setEpNoError('')

    if (!epName.trim()) {
      return
    }
    const blocks = tiptapToNovelBlocks(content)
    if (blocks.length === 0) {
      return
    }

    let scheduleDatetime: string | undefined
    if (publishMode === 'schedule') {
      if (!scheduleDate || !scheduleTime) {
        setScheduleError('กรุณาเลือกวันเวลาที่จะเผยแพร่ให้มากกว่าวันเวลาปัจจุบัน')
        return
      }
      const dt = new Date(`${scheduleDate}T${scheduleTime}`)
      if (Number.isNaN(dt.getTime()) || dt.getTime() <= Date.now()) {
        setScheduleError('กรุณาเลือกวันเวลาที่จะเผยแพร่ให้มากกว่าวันเวลาปัจจุบัน')
        return
      }
      scheduleDatetime = dt.toISOString()
    }
    setScheduleError('')

    setSaving(true)
    try {
      await api.post(`/writer/works/${workUuid}/episodes`, {
        ep_name: epName.trim(),
        ep_no: epNoValue,
        episode_label: epLabel.trim() || null,
        reader_message: readerMessage.trim() || null,
        ep_price: priceMode === 'paid' ? priceValue : '0',
        publish_status: publishMode,
        schedule_datetime: scheduleDatetime,
        ep_content: blocks,
      })
      setOpen(false)
      onCreated()
    } catch (err: any) {
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilePlus2 className="size-5 text-primary" />
            เพิ่มตอนนิยายใหม่
          </DialogTitle>
        </DialogHeader>

        <div
          role="tablist"
          aria-label="รูปแบบการเพิ่มตอน"
          className="grid grid-cols-2 rounded-xl border border-border bg-muted/50 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={creationMode === 'single'}
            onClick={() => setCreationMode('single')}
            className={cn(
              'cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold transition-all',
              creationMode === 'single'
                ? 'bg-card text-primary shadow-sm ring-1 ring-border/60'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            เพิ่มตอนเดียว
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={creationMode === 'bulk'}
            onClick={() => setCreationMode('bulk')}
            className={cn(
              'cursor-pointer rounded-lg px-3 py-2 text-sm font-semibold transition-all',
              creationMode === 'bulk'
                ? 'bg-card text-primary shadow-sm ring-1 ring-border/60'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            เพิ่มหลายตอน
          </button>
        </div>

        {creationMode === 'single' ? (
          <>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/10 px-4 py-2.5 text-sm text-primary">
          <span>
            ตอนก่อนหน้า : {previousEpNo ?? 'ยังไม่มี'}
            {isWorkCompleted && previousEpNo !== null && ' (จบ)'}
          </span>
          <span>จำนวนตอนทั้งหมด : {totalEpisodes}</span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              ลำดับตอน<span className="text-destructive">*</span>
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={epNo}
              onChange={(e) => {
                setEpNo(e.target.value)
                setEpNoError('')
              }}
              placeholder="เช่น 0, 1, 2..."
              className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {epNoError && <p className="mt-1 text-xs text-destructive">{epNoError}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">คำเรียกตอน</label>
            <input
              value={epLabel}
              onChange={(e) => setEpLabel(e.target.value)}
              placeholder="เช่น ตอนที่, บทที่ (เว้นว่างได้ถ้าไม่ต้องการ)"
              className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              พิมพ์แค่คำ ระบบเติมเลขให้เอง และจะจำไว้ใช้กับทุกตอนของเรื่องนี้อัตโนมัติ
            </p>
          </div>
        </div>

        {epName.trim() && !Number.isNaN(Number(epNo)) && epNo.trim() !== '' && (
          <p className="text-sm text-muted-foreground">
            ตัวอย่าง: <span className="font-medium text-foreground">{formatEpisodeTitle(Number(epNo), epLabel, epName.trim())}</span>
          </p>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              ชื่อตอน<span className="text-destructive">*</span>
            </label>
            <span className="text-xs text-muted-foreground">
              {epName.length}/{EP_NAME_MAX}
            </span>
          </div>
          <input
            value={epName}
            onChange={(e) => setEpName(e.target.value.slice(0, EP_NAME_MAX))}
            placeholder="ชื่อตอน"
            className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            เนื้อหา<span className="text-destructive">*</span>
          </label>
          <RichTextEditor key={editorKey} content={content} onChange={setContent} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">ข้อความถึงนักอ่าน</label>
            <span className="text-xs text-muted-foreground">
              {readerMessage.length}/{READER_MESSAGE_MAX}
            </span>
          </div>
          <textarea
            value={readerMessage}
            onChange={(e) => setReaderMessage(e.target.value.slice(0, READER_MESSAGE_MAX))}
            rows={2}
            placeholder="ข้อความถึงนักอ่าน"
            className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">ตั้งค่าตอน</label>
          <div className="grid grid-cols-1 gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
            <div className="flex flex-col gap-3 sm:border-r sm:border-border sm:pr-4">
              <RadioRow selected={priceMode === 'free'} onSelect={() => setPriceMode('free')}>
                อ่านฟรี
              </RadioRow>
              <RadioRow selected={priceMode === 'paid'} onSelect={() => setPriceMode('paid')}>
                <span className="flex items-center gap-1">
                  กำหนดราคาเหรียญ
                  <span title="ราคาที่ผู้อ่านต้องจ่ายเพื่อปลดล็อกตอนนี้ (หน่วยเป็นเหรียญ)">
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </span>
                </span>
              </RadioRow>
              {priceMode === 'paid' && (
                <div className="ml-6 flex items-center gap-2 rounded-lg border border-input px-3 py-2">
                  <Coins className="size-4 shrink-0 text-amber-500" />
                  <input
                    type="number"
                    min={0}
                    value={priceValue}
                    onChange={(e) => setPriceValue(e.target.value)}
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <RadioRow selected={publishMode === 'hide'} onSelect={() => setPublishMode('hide')}>
                ซ่อน
              </RadioRow>
              <RadioRow selected={publishMode === 'now'} onSelect={() => setPublishMode('now')}>
                เผยแพร่ทันที
              </RadioRow>
              <RadioRow selected={publishMode === 'schedule'} onSelect={() => setPublishMode('schedule')}>
                ตั้งเวลาเผยแพร่
              </RadioRow>
              {publishMode === 'schedule' && (
                <div className="ml-6 flex flex-col gap-2">
                  <div className="flex gap-2">
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
                  {scheduleError && <p className="text-xs text-destructive">{scheduleError}</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-destructive">
          *การกดยกเลิกหรือปิดหน้าต่างจะล้างข้อมูลในแบบฟอร์มนี้ทันที
        </p>

        <div className="flex justify-center gap-3">
          <Button type="button" variant="destructive" onClick={() => setOpen(false)} className="rounded-full px-6">
            ยกเลิก
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={saving} className="rounded-full px-6">
            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </Button>
        </div>
          </>
        ) : (
          <BulkEpisodeUploadPanel
            workUuid={workUuid}
            latestEpisodeLabel={latestEpisodeLabel}
            onUploaded={onCreated}
            onClose={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
