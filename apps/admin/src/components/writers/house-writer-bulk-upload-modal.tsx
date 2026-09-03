'use client'

/**
 * components/writers/house-writer-bulk-upload-modal.tsx — "เพิ่มนิยายหลายเรื่อง" (2026-08-10, ใหม่)
 *
 * โครงสร้าง zip: โฟลเดอร์ระดับบนสุด = 1 นิยาย/โฟลเดอร์ ข้างในมีไฟล์ตอน + รูปปก 1 ไฟล์ (เดาจาก
 * นามสกุลไฟล์รูปในโฟลเดอร์เอง) — ทุกเรื่อง/ทุกตอนที่สร้างจากตรงนี้ถูกซ่อนไว้เสมอ (ยังไม่เผยแพร่, ราคา 0)
 * ประมวลผลเบื้องหลัง ปิดหน้าต่างนี้ได้ระหว่างรอ (ดู admin-house-writer.service.ts)
 *
 * รายงานผลหลังอัปโหลด (2026-08-10 user ขอเพิ่ม) — โชว์ละเอียดเป็นรายเรื่อง+รายตอน เลื่อนดูได้ ไม่ใช่
 * แค่สรุปตัวเลขเฉยๆ กดขยายแต่ละเรื่องดูได้ว่าตอนไหนสำเร็จ/ไม่สำเร็จ/ซ้ำ พร้อมเหตุผล
 */

import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileArchive,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface FailedItem {
  folder_name: string
  reason: string
}
interface EpisodeOutcome {
  filename: string
  ep_no: number | null
  ep_name: string
  status: 'success' | 'failed'
  reason?: string
}
interface CreatedWork {
  uuid: string
  title: string
  note?: string
  episodes: EpisodeOutcome[]
}
interface JobStatus {
  job_id: string
  status: 'processing' | 'completed' | 'failed'
  total: number
  processed: number
  failed_items: FailedItem[]
  created_works: CreatedWork[]
  error_message: string | null
}

const POLL_INTERVAL_MS = 1500

const EP_STATUS_LABEL: Record<EpisodeOutcome['status'], string> = {
  success: 'สำเร็จ',
  failed: 'ไม่สำเร็จ',
}
const EP_STATUS_CLASS: Record<EpisodeOutcome['status'], string> = {
  success: 'text-teal-600',
  failed: 'text-destructive',
}

function NovelReportRow({ work }: { work: CreatedWork }) {
  const [expanded, setExpanded] = useState(false)
  const issueCount = work.episodes.filter((e) => e.status !== 'success').length

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted"
      >
        <span className="flex items-center gap-1.5 text-sm text-foreground">
          {expanded ? <ChevronDown className="size-3.5 shrink-0" /> : <ChevronRight className="size-3.5 shrink-0" />}
          {work.title}
        </span>
        <span className={cn('shrink-0 text-xs', issueCount > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
          {work.episodes.length - issueCount}/{work.episodes.length} ตอนสำเร็จ
        </span>
      </button>
      {expanded && (
        <div className="space-y-1 bg-muted/40 px-3 py-2">
          {work.note && <p className="mb-1 text-xs text-amber-700">{work.note}</p>}
          {work.episodes.length === 0 ? (
            <p className="text-xs text-muted-foreground">ไม่มีไฟล์ตอนในโฟลเดอร์นี้</p>
          ) : (
            work.episodes.map((e, i) => (
              <div key={`${e.filename}-${i}`} className="flex items-start justify-between gap-2 text-xs">
                <span className="font-mono text-muted-foreground">{e.filename}</span>
                <span className="text-right">
                  <span className={EP_STATUS_CLASS[e.status]}>
                    {e.status === 'success' ? `ตอนที่ ${e.ep_no}` : EP_STATUS_LABEL[e.status]}
                  </span>
                  {e.reason && <span className="block text-muted-foreground">{e.reason}</span>}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function HouseWriterBulkUploadModal({
  targetUuid,
  onClose,
  onUploaded,
}: {
  targetUuid: string
  onClose: () => void
  onUploaded: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [job, setJob] = useState<JobStatus | null>(null)
  const [stripForeignChunks, setStripForeignChunks] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const notifiedRef = useRef(false)

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
      setError('รองรับเฉพาะไฟล์ .zip เท่านั้น')
      return
    }
    setError(null)
    setFile(nextFile)
  }

  function pollStatus(jobId: string) {
    pollRef.current = setInterval(async () => {
      try {
        const status = await api
          .get<{ data: JobStatus }>(`/admin/house-writer-uploads/${jobId}`)
          .then((res) => res.data)
        setJob(status)

        if (status.status === 'completed') {
          stopPolling()
          if (!notifiedRef.current) {
            notifiedRef.current = true
            onUploaded()
          }
        } else if (status.status === 'failed') {
          stopPolling()
        }
      } catch (err: any) {
        stopPolling()
        setError(err?.message ?? 'เช็คความคืบหน้าไม่สำเร็จ')
      }
    }, POLL_INTERVAL_MS)
  }

  async function handleSubmit() {
    if (!file) return

    setError(null)
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('zip', file)
      formData.append('strip_foreign_chunks', String(stripForeignChunks))

      const result = await api
        .post<{ data: { job_id: string; total: number } }>(
          `/admin/house-writers/${targetUuid}/works/bulk-upload`,
          formData,
        )
        .then((res) => res.data)

      setJob({
        job_id: result.job_id,
        status: 'processing',
        total: result.total,
        processed: 0,
        failed_items: [],
        created_works: [],
        error_message: null,
      })
      pollStatus(result.job_id)
    } catch (err: any) {
      setError(err?.message ?? 'อัปโหลดไม่สำเร็จ ลองใหม่อีกครั้ง')
      setSubmitting(false)
    }
  }

  const isDone = job?.status === 'completed'
  const isFailed = job?.status === 'failed'

  return (
    <Modal open onClose={onClose} title="เพิ่มนิยายหลายเรื่อง" size="lg">
      {job ? (
        <div className="flex flex-col items-center gap-4 py-6">
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
              <FileArchive className="size-9 animate-pulse text-primary" />
              <p className="text-sm font-medium text-foreground">กำลังสร้างนิยายจากไฟล์ที่อัปโหลด</p>
              <p className="text-sm text-muted-foreground">
                ดำเนินการแล้ว {job.processed} / {job.total || '?'} เรื่อง
              </p>
              <p className="text-center text-xs text-muted-foreground">
                ปิดหน้าต่างนี้ได้ แต่ระบบจะยังประมวลผลต่อบนเซิร์ฟเวอร์
              </p>
            </>
          ) : (
            <>
              {job.failed_items.length === 0 ? (
                <CheckCircle2 className="size-9 text-teal-500" />
              ) : (
                <AlertTriangle className="size-9 text-amber-500" />
              )}
              <p className="text-center text-sm font-semibold text-foreground">
                สร้างสำเร็จ {job.created_works.length} / {job.total} เรื่อง
                {job.failed_items.length > 0 && ` — ไม่สำเร็จ ${job.failed_items.length} เรื่อง`}
              </p>

              {job.failed_items.length > 0 && (
                <div className="w-full space-y-1 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs">
                  {job.failed_items.map((f) => (
                    <p key={f.folder_name} className="text-destructive">
                      <span className="font-mono">{f.folder_name}</span>: {f.reason}
                    </p>
                  ))}
                </div>
              )}

              {job.created_works.length > 0 && (
                <div className="w-full">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    รายละเอียดรายเรื่อง (กดชื่อเรื่องเพื่อดูรายตอน)
                  </p>
                  <div className="max-h-80 overflow-y-auto rounded-xl border border-border">
                    {job.created_works.map((w) => (
                      <NovelReportRow key={w.uuid} work={w} />
                    ))}
                  </div>
                </div>
              )}

              <Button type="button" onClick={onClose} className="rounded-full px-6">
                เสร็จสิ้น
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
            <p className="text-sm font-semibold text-foreground">เตรียมไฟล์ก่อนอัปโหลด</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>สร้าง 1 โฟลเดอร์ต่อ 1 นิยาย ตั้งชื่อโฟลเดอร์เป็นชื่อเรื่อง</li>
              <li>
                ในแต่ละโฟลเดอร์ ใส่ไฟล์ตอน ขึ้นต้นด้วยเลขตอน (จำนวนเต็มหรือทศนิยมก็ได้ เช่น{' '}
                <span className="font-mono text-foreground">46.txt</span>,{' '}
                <span className="font-mono text-foreground">46.5_ตอนพิเศษ.docx</span>) — เลขนี้ใช้จัดลำดับตอน
                (46.5 จะถูกวางไว้ระหว่างตอน 46 กับ 47 ให้ถูกต้อง) ส่วนหลังเลขจะใส่อะไรก็ได้ + รูปปก{' '}
                <span className="font-medium text-foreground">1 ไฟล์เท่านั้น</span> (jpg/png/webp)
              </li>
              <li>รวมทุกโฟลเดอร์เป็นไฟล์ <span className="font-mono text-foreground">.zip</span> เดียว แล้วอัปโหลด</li>
            </ol>
            <p className="mt-2 text-xs text-amber-700">
              ⚠️ ไฟล์รูปเกิน 1 ไฟล์ในโฟลเดอร์เดียว = ไม่สร้างนิยายเรื่องนั้นเลย (เดาไม่ได้ว่าไฟล์ไหนคือปก) —
              โฟลเดอร์อื่นที่ไม่มีปัญหาจะอัปโหลดสำเร็จตามปกติ ดูรายละเอียดได้ตอนอัปโหลดเสร็จ
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              สูงสุด 150 โฟลเดอร์ รวมไม่เกิน 500MB — ทุกเรื่องที่สร้างจะถูกซ่อนไว้ (ยังไม่เผยแพร่) เสมอ
              เข้าไปแก้รายละเอียด/สั่งเผยแพร่ทีละเรื่องได้ทีหลัง
            </p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">ตัดข้อความภาษาต่างประเทศทิ้ง</p>
              <p className="text-xs text-muted-foreground">
                สำหรับไฟล์แปล — ตัดย่อหน้าที่เป็นเกาหลี/อังกฤษล้วนๆ (ไม่มีไทยปนเลย) ทิ้งอัตโนมัติ ย่อหน้าที่มีไทยปนอยู่ด้วยจะไม่ถูกแตะ
              </p>
            </div>
            <Switch checked={stripForeignChunks} onCheckedChange={setStripForeignChunks} />
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              handleFile(e.dataTransfer.files?.[0])
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
              dragOver ? 'border-primary bg-primary/5' : 'border-input hover:bg-muted/70',
            )}
          >
            <input ref={inputRef} type="file" accept=".zip" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            {file ? (
              <>
                <FileArchive className="size-9 text-primary" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
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
                  <p className="mt-1 text-xs text-muted-foreground">โฟลเดอร์ระดับบนสุดในไฟล์ zip คือ 1 นิยายต่อโฟลเดอร์</p>
                </div>
              </>
            )}
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!file || submitting}>
              {submitting ? 'กำลังอัปโหลด...' : 'อัปโหลดและสร้างนิยาย'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
