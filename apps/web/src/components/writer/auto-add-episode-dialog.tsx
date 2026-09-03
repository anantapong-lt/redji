'use client'

import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Coins,
  FileArchive,
  HelpCircle,
  Sparkles,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface FailedFile {
  filename: string
  reason: string
}

// 2026-08-10 user ขอ — อยากเห็นรายงานผลแบบเลื่อนดูได้ว่าตอนไหนอัพสำเร็จเป็นตอนอะไรบ้าง ไม่ใช่แค่ตัวเลขรวม
interface SucceededFile {
  filename: string
  ep_no: number
  ep_name: string
}

interface JobStatus {
  job_id: string
  status: 'processing' | 'completed' | 'failed'
  total: number
  processed: number
  failed_files: FailedFile[]
  succeeded_files: SucceededFile[]
  error_message: string | null
}

type PriceMode = 'free' | 'paid'
type PublishMode = 'hide' | 'now' | 'schedule'

const POLL_INTERVAL_MS = 1500
const READER_MESSAGE_MAX = 200

function RadioOption({
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

// แผง "เพิ่มหลายตอน" ใช้ภายในหน้าต่างเพิ่มตอนเดียวกัน ไม่เปิด Dialog ซ้อนอีกชั้น
// ทุกค่าที่กรอกในกลุ่มตั้งค่าตอนจะถูกส่งให้ทุกไฟล์ใน ZIP จริงผ่าน bulk-upload endpoint
export function BulkEpisodeUploadPanel({
  workUuid,
  latestEpisodeLabel,
  onUploaded,
  onClose,
}: {
  workUuid: string
  latestEpisodeLabel: string | null
  onUploaded: () => void
  onClose: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [job, setJob] = useState<JobStatus | null>(null)
  const [epLabel, setEpLabel] = useState(latestEpisodeLabel ?? '')
  const [readerMessage, setReaderMessage] = useState('')
  const [priceMode, setPriceMode] = useState<PriceMode>('free')
  const [priceValue, setPriceValue] = useState('0')
  const [publishMode, setPublishMode] = useState<PublishMode>('now')
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('')
  const [scheduleError, setScheduleError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  useEffect(() => () => stopPolling(), [])

  function handleFile(nextFile: File | null | undefined) {
    if (!nextFile) return
    if (!nextFile.name.toLowerCase().endsWith('.zip')) {
      return
    }
    setFile(nextFile)
  }

  function pollStatus(jobId: string) {
    pollRef.current = setInterval(async () => {
      try {
        const status = await api
          .get<{ data: JobStatus }>('/writer/episode-uploads/' + jobId)
          .then((res) => res.data)
        setJob(status)

        if (status.status === 'completed') {
          stopPolling()
          onUploaded()
        } else if (status.status === 'failed') {
          stopPolling()
        }
      } catch (err: any) {
        stopPolling()
      }
    }, POLL_INTERVAL_MS)
  }

  async function handleSubmit() {
    if (!file) return

    const price = priceMode === 'paid' ? priceValue.trim() : '0'
    if (!/^\d+$/.test(price)) {
      return
    }

    let scheduleDatetime = ''
    if (publishMode === 'schedule') {
      if (!scheduleDate || !scheduleTime) {
        setScheduleError('กรุณาเลือกวันและเวลาที่จะเผยแพร่')
        return
      }
      const schedule = new Date(scheduleDate + 'T' + scheduleTime)
      if (Number.isNaN(schedule.getTime()) || schedule.getTime() <= Date.now()) {
        setScheduleError('กรุณาเลือกวันเวลาที่จะเผยแพร่ให้มากกว่าวันเวลาปัจจุบัน')
        return
      }
      scheduleDatetime = schedule.toISOString()
    }
    setScheduleError('')

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('zip', file)
      formData.append('ep_price', price)
      formData.append('publish_status', publishMode)
      formData.append('reader_message', readerMessage.trim())
      formData.append('episode_label', epLabel.trim())
      if (scheduleDatetime) formData.append('schedule_datetime', scheduleDatetime)

      const { job_id } = await api
        .post<{ data: { job_id: string } }>('/writer/works/' + workUuid + '/episodes/bulk-upload', formData)
        .then((res) => res.data)

      setJob({ job_id, status: 'processing', total: 0, processed: 0, failed_files: [], succeeded_files: [], error_message: null })
      pollStatus(job_id)
    } catch (err: any) {
      setSubmitting(false)
    }
  }

  const isDone = job?.status === 'completed'
  const isFailed = job?.status === 'failed'
  const succeededCount = job ? job.total - job.failed_files.length : 0

  if (job) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        {isFailed ? (
          <>
            <XCircle className="size-9 text-destructive" />
            <p className="text-center text-sm font-semibold text-foreground">อัปโหลดล้มเหลว</p>
            <p className="max-w-md text-center text-xs text-muted-foreground">
              {job.error_message ?? 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'}
            </p>
            <Button type="button" onClick={onClose} className="rounded-full px-6">
              ปิด
            </Button>
          </>
        ) : !isDone ? (
          <>
            <Sparkles className="size-9 animate-pulse text-primary" />
            <p className="text-sm font-medium text-foreground">กำลังสร้างตอนจากไฟล์ที่อัปโหลด</p>
            <p className="text-sm text-muted-foreground">
              ดำเนินการแล้ว {job.processed} / {job.total || '?'} ตอน
            </p>
            <p className="text-center text-xs text-muted-foreground">
              ปิดหน้าต่างนี้ได้ แต่ระบบจะยังประมวลผลต่อบนเซิร์ฟเวอร์
            </p>
          </>
        ) : (
          <>
            {job.failed_files.length === 0 ? (
              <CheckCircle2 className="size-9 text-teal-500" />
            ) : (
              <AlertTriangle className="size-9 text-amber-500" />
            )}
            <p className="text-center text-sm font-semibold text-foreground">
              สร้างสำเร็จ {succeededCount} / {job.total} ตอน
              {job.failed_files.length > 0 && ' — ไม่สำเร็จ ' + job.failed_files.length + ' ไฟล์'}
            </p>

            {(job.succeeded_files.length > 0 || job.failed_files.length > 0) && (
              <div className="max-h-72 w-full space-y-1 overflow-y-auto rounded-xl border border-border p-3 text-xs">
                {job.succeeded_files
                  .slice()
                  .sort((a, b) => a.ep_no - b.ep_no)
                  .map((f) => (
                    <p key={f.filename} className="flex items-start justify-between gap-2 text-teal-600">
                      <span className="font-mono text-muted-foreground">{f.filename}</span>
                      <span className="text-right">ตอนที่ {f.ep_no} — {f.ep_name}</span>
                    </p>
                  ))}
                {job.failed_files.map((failedFile) => (
                  <p key={failedFile.filename} className="flex items-start justify-between gap-2 text-destructive">
                    <span className="font-mono text-muted-foreground">{failedFile.filename}</span>
                    <span className="text-right">{failedFile.reason}</span>
                  </p>
                ))}
              </div>
            )}
            <Button type="button" onClick={onClose} className="rounded-full px-6">
              เสร็จสิ้น
            </Button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
        <p className="text-sm font-semibold text-foreground">เตรียมไฟล์ก่อนอัปโหลด</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>รวมไฟล์ตอนทั้งหมดเป็นไฟล์ <span className="font-mono text-foreground">.zip</span> เดียว</li>
          <li>
            ใช้ชื่อไฟล์ <span className="font-mono text-foreground">01_ชื่อตอน.docx</span> หรือ{' '}
            <span className="font-mono text-foreground">02.txt</span> เพื่อเรียงลำดับ
          </li>
          <li>ระบบสร้างตอนต่อจากตอนล่าสุดของเรื่อง ไม่ใช้ตัวเลขในชื่อไฟล์เป็นเลขตอนโดยตรง</li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          รองรับเฉพาะ <span className="font-mono">.txt</span> และ <span className="font-mono">.docx</span> ภายใน ZIP —
          สูงสุด 200 ไฟล์ รวมไม่เกิน 50MB
        </p>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(false)
          handleFile(event.dataTransfer.files?.[0])
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragOver ? 'border-primary bg-primary/5' : 'border-input hover:bg-muted/70',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        {file ? (
          <>
            <FileArchive className="size-9 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setFile(null)
              }}
              className="flex cursor-pointer items-center gap-1 text-xs text-destructive hover:underline"
            >
              <X className="size-3.5" />
              เอาไฟล์ออก
            </button>
          </>
        ) : (
          <>
            <UploadCloud className="size-9 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">ลากไฟล์ .zip มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</p>
              <p className="mt-1 text-xs text-muted-foreground">ไฟล์ภายในต้องขึ้นต้นด้วยตัวเลข เช่น 01_บทเปิดเรื่อง.docx</p>
            </div>
          </>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">ข้อความถึงนักอ่าน</label>
          <span className="text-xs text-muted-foreground">{readerMessage.length}/{READER_MESSAGE_MAX}</span>
        </div>
        <textarea
          value={readerMessage}
          onChange={(event) => setReaderMessage(event.target.value.slice(0, READER_MESSAGE_MAX))}
          rows={2}
          placeholder="ข้อความนี้จะแสดงกับทุกตอนที่อัปโหลด"
          className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p className="mt-1 text-xs text-muted-foreground">ใช้ข้อความเดียวกันกับทุกตอนในชุดนี้</p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">คำเรียกตอน</label>
        <input
          value={epLabel}
          onChange={(event) => setEpLabel(event.target.value.slice(0, 30))}
          placeholder="เช่น ตอนที่, บทที่ (เว้นว่างได้)"
          className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p className="mt-1 text-xs text-muted-foreground">ใช้คำเรียกเดียวกันกับทุกตอนที่อัปโหลด</p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">ตั้งค่าตอนทั้งหมด</label>
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-border p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3 sm:border-r sm:border-border sm:pr-4">
            <RadioOption selected={priceMode === 'free'} onSelect={() => setPriceMode('free')}>
              อ่านฟรี
            </RadioOption>
            <RadioOption selected={priceMode === 'paid'} onSelect={() => setPriceMode('paid')}>
              <span className="flex items-center gap-1">
                กำหนดราคาเหรียญ
                <span title="ราคาที่ผู้อ่านต้องจ่ายเพื่อปลดล็อกทุกตอนในชุดนี้">
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </span>
              </span>
            </RadioOption>
            {priceMode === 'paid' && (
              <div className="ml-6 flex items-center gap-2 rounded-lg border border-input px-3 py-2">
                <Coins className="size-4 shrink-0 text-amber-500" />
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={priceValue}
                  onChange={(event) => setPriceValue(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <RadioOption selected={publishMode === 'hide'} onSelect={() => setPublishMode('hide')}>
              ซ่อน
            </RadioOption>
            <RadioOption selected={publishMode === 'now'} onSelect={() => setPublishMode('now')}>
              เผยแพร่ทันที
            </RadioOption>
            <RadioOption selected={publishMode === 'schedule'} onSelect={() => setPublishMode('schedule')}>
              ตั้งเวลาเผยแพร่
            </RadioOption>
            {publishMode === 'schedule' && (
              <div className="ml-6 flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">วันที่</label>
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(event) => setScheduleDate(event.target.value)}
                      className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">เวลา</label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(event) => setScheduleTime(event.target.value)}
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

      <p className="text-center text-xs text-muted-foreground">
        ระบบจะประมวลผลทีละไฟล์ หากไฟล์ใดอ่านไม่ได้ ระบบข้ามไฟล์นั้นและสรุปผลให้เมื่อเสร็จ
      </p>

      <div className="flex justify-center gap-3">
        <Button type="button" variant="destructive" onClick={onClose} className="rounded-full px-6">
          ยกเลิก
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={!file || submitting} className="rounded-full px-6">
          {submitting ? 'กำลังอัปโหลด...' : 'อัปโหลดและสร้างตอน'}
        </Button>
      </div>
    </div>
  )
}
