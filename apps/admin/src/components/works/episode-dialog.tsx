'use client'

/**
 * components/works/episode-dialog.tsx — สร้าง/แก้ไขตอน (2026-08-04, ใหม่)
 *
 * รวม CreateEpisodeDialog + EditEpisodeDialog ของฝั่ง writer เป็นไฟล์เดียว (โครง/field เดียวกันเป๊ะ
 * ต่างกันแค่ create=POST ไม่ preload ข้อมูล, edit=PATCH preload ข้อมูลเดิมมาก่อน) ใช้ Modal ของ
 * apps/admin เอง (ไม่ใช่ Radix Dialog แบบฝั่ง writer) — เปิด/ปิดคุมจาก parent เสมอทั้ง 2 โหมด
 */

import { useEffect, useState } from 'react'
import type { JSONContent } from '@tiptap/react'
import { useQuery } from '@tanstack/react-query'
import { HelpCircle, Coins } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from './rich-text-editor'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatEpisodeTitle } from '@/lib/episode-format'
import { tiptapToNovelBlocks, novelBlocksToTiptap } from '@/lib/novel-blocks'
import type { AdminEpisodeDetail } from '@/types'

const EP_NAME_MAX = 120
const READER_MESSAGE_MAX = 200

type PriceMode = 'free' | 'paid'
type PublishMode = 'hide' | 'now' | 'schedule'

function RadioRow({
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

export function EpisodeDialog({
  workUuid,
  epId,
  open,
  onClose,
  previousEpNo,
  totalEpisodes,
  isWorkCompleted,
  existingEpNos,
  latestEpisodeLabel,
  onSaved,
}: {
  workUuid: string
  /** null = โหมดสร้างตอนใหม่, มีค่า = โหมดแก้ไขตอนนี้ */
  epId: string | null
  open: boolean
  onClose: () => void
  previousEpNo: number | null
  totalEpisodes: number
  isWorkCompleted: boolean
  existingEpNos: number[]
  latestEpisodeLabel: string | null
  onSaved: () => void
}) {
  const isEdit = epId !== null

  const { data: episode, isLoading: episodeLoading } = useQuery({
    queryKey: ['admin', 'episode-edit', epId],
    queryFn: () => api.get<{ data: AdminEpisodeDetail }>(`/admin/episodes/${epId}`).then((res) => res.data),
    enabled: open && isEdit,
  })

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
  const [error, setError] = useState<string | null>(null)
  // Tiptap เก็บ document ภายในตัวเอง ไม่ sync กับ prop content หลัง mount ครั้งแรก
  const [editorKey, setEditorKey] = useState(0)

  // โหมดสร้าง: เปิดหน้าต่างแล้วเสนอเลขลำดับตอนถัดไป + คำเรียกตอนล่าสุดให้อัตโนมัติ
  useEffect(() => {
    if (open && !isEdit) {
      setEpNo(String(previousEpNo !== null ? previousEpNo + 1 : 0))
      setEpLabel(latestEpisodeLabel ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit])

  // โหมดแก้ไข: เติมข้อมูลเดิมมาให้ทันทีที่ fetch เสร็จ
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
  }, [episode])

  // ล้างฟอร์มทันทีที่ปิดหน้าต่าง
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
      setError(null)
      setEditorKey((k) => k + 1)
    }
  }, [open])

  async function handleSubmit() {
    setError(null)
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
      setError('กรุณากรอกชื่อตอนก่อน')
      return
    }
    const blocks = tiptapToNovelBlocks(content)
    if (blocks.length === 0) {
      setError('กรุณากรอกเนื้อหาก่อน')
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

    const payload = {
      ep_name: epName.trim(),
      ep_no: epNoValue,
      episode_label: epLabel.trim() || null,
      reader_message: readerMessage.trim() || null,
      ep_price: priceMode === 'paid' ? priceValue : '0',
      publish_status: publishMode,
      schedule_datetime: scheduleDatetime,
      ep_content: blocks,
    }

    setSaving(true)
    try {
      if (isEdit) {
        await api.patch(`/admin/episodes/${epId}`, payload)
      } else {
        await api.post(`/admin/works/${workUuid}/episodes`, payload)
      }
      onClose()
      onSaved()
    } catch (err: any) {
      setError(err?.message ?? 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      size="xl"
      title={isEdit ? 'แก้ไขตอน' : 'เพิ่มตอนนิยายใหม่'}
    >
      {isEdit && episodeLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : (
        <div className="flex flex-col gap-4">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {!isEdit && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/10 px-4 py-2.5 text-sm text-primary">
              <span>
                ตอนก่อนหน้า : {previousEpNo ?? 'ยังไม่มี'}
                {isWorkCompleted && previousEpNo !== null && ' (จบ)'}
              </span>
              <span>จำนวนตอนทั้งหมด : {totalEpisodes}</span>
            </div>
          )}

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
            <Button type="button" variant="destructive" onClick={onClose} className="rounded-full px-6" disabled={saving}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={saving} className="rounded-full px-6">
              {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
