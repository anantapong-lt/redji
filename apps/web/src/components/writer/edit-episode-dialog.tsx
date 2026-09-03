'use client'

import { useEffect, useState } from 'react'
import type { JSONContent } from '@tiptap/react'
import { useQuery } from '@tanstack/react-query'
import { Pencil, HelpCircle, Coins } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from './rich-text-editor'
import { RadioRow } from './create-episode-dialog'
import { api } from '@/lib/api'
import { formatEpisodeTitle } from '@/lib/episode-format'
import { tiptapToNovelBlocks, novelBlocksToTiptap } from '@/lib/novel-blocks'
import type { NovelBlock } from '@/types'

const EP_NAME_MAX = 120
const READER_MESSAGE_MAX = 200

type PriceMode = 'free' | 'paid'
type PublishMode = 'hide' | 'now' | 'schedule'

interface ApiEpisodeEdit {
  ep_id: string
  ep_no: number
  ep_name: string
  ep_price: string
  ep_content: NovelBlock[] | null
  publish_status: 'now' | 'schedule' | 'hide'
  schedule_datetime: string | null
  lock_duration_days: number | null
  image_protection: boolean
  reader_message: string | null
  episode_label: string | null
  type: 'novel' | 'manga'
}

// หน้าต่างแก้ไขตอน — โครงเดียวกับ CreateEpisodeDialog แต่โหลดข้อมูลเดิมของตอนมาเติมให้ก่อน
// แล้วบันทึกผ่าน PATCH แทน POST — เปิด/ปิดควบคุมจาก parent (episode-list-table.tsx)
// เพราะต้องรู้ก่อนว่าจะแก้ ep_id ไหน (ต่างจาก create ที่เปิดจาก trigger ในตัวเองได้เลย)
export function EditEpisodeDialog({
  epId,
  open,
  onOpenChange,
  existingEpNos,
  onUpdated,
}: {
  epId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  existingEpNos: number[]
  onUpdated: () => void
}) {
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
  const [editorKey, setEditorKey] = useState(0)

  const { data: episode, isLoading } = useQuery({
    queryKey: ['writer', 'episode', epId],
    queryFn: () => api.get<{ data: ApiEpisodeEdit }>(`/writer/episodes/${epId}`).then((res) => res.data),
    enabled: open && !!epId,
  })

  // โหลดข้อมูลเดิมของตอนมาเติมฟอร์มทันทีที่ fetch เสร็จ
  useEffect(() => {
    if (!episode) return
    setEpNo(String(episode.ep_no))
    setEpLabel(episode.episode_label ?? '')
    setEpName(episode.ep_name)
    setContent(novelBlocksToTiptap(episode.ep_content))
    setReaderMessage(episode.reader_message ?? '')
    setEditorKey((k) => k + 1)
    const price = Number(episode.ep_price)
    setPriceMode(price > 0 ? 'paid' : 'free')
    setPriceValue(price > 0 ? String(price) : '0')
    setPublishMode(episode.publish_status)
    if (episode.schedule_datetime) {
      const dt = new Date(episode.schedule_datetime)
      setScheduleDate(dt.toISOString().slice(0, 10))
      setScheduleTime(dt.toISOString().slice(11, 16))
    } else {
      setScheduleDate('')
      setScheduleTime('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode])

  // ล้างฟอร์มทันทีที่ปิดหน้าต่าง
  useEffect(() => {
    if (!open) {
      setEpNo('')
      setEpLabel('')
      setEpNoError('')
      setEpName('')
      setContent(undefined)
      setReaderMessage('')
      setPriceMode('free')
      setPriceValue('0')
      setPublishMode('now')
      setScheduleDate('')
      setScheduleTime('')
      setScheduleError('')
    }
  }, [open])

  async function handleSubmit() {
    if (!epId) return
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
      await api.patch(`/writer/episodes/${epId}`, {
        ep_name: epName.trim(),
        ep_no: epNoValue,
        episode_label: epLabel.trim() || null,
        reader_message: readerMessage.trim() || null,
        ep_price: priceMode === 'paid' ? priceValue : '0',
        publish_status: publishMode,
        schedule_datetime: scheduleDatetime,
        ep_content: blocks,
      })
      onOpenChange(false)
      onUpdated()
    } catch (err: any) {
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="size-5 text-primary" />
            แก้ไขตอน
          </DialogTitle>
        </DialogHeader>

        {isLoading || !episode ? (
          <p className="py-10 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : (
          <>
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
                      <HelpCircle
                        className="size-3.5 text-muted-foreground"
                      />
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

            <div className="flex justify-center gap-3">
              <Button type="button" variant="destructive" onClick={() => onOpenChange(false)} className="rounded-full px-6">
                ยกเลิก
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={saving} className="rounded-full px-6">
                {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
