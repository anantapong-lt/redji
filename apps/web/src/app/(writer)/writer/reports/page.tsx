'use client'

/**
 * app/(writer)/writer/reports/page.tsx — "รายงานที่ได้รับ" (2026-08-06, ใหม่)
 *
 * 2 แท็บแยกกันตามที่ user ขอ:
 * 1. "รายงานจากนักอ่าน" — content_reports หมวด 'content_error' เท่านั้น (routing มาจาก
 *    reportContent() ฝั่ง social.service.ts) รายงานหมวดอื่นทั้งหมดยังเข้าคิวแอดมินตามเดิม
 * 2. "รายงานจากแอดมิน" — writer_admin_notices ที่แอดมินส่งถึงเราตรงๆ จากหน้าจัดการผลงาน
 *
 * ทั้ง 2 แท็บตอบกลับสั้นๆ ได้ (หมายเหตุ) เพื่อแสดงว่าเห็นแล้ว — หมายเหตุนี้ไปโผล่ในหน้าแอดมิน
 * (คิวรายงานเดิม/ไม่มีหน้า UI แยก) เท่านั้น ไม่มีทางไปโผล่ที่นักอ่านเห็นได้เลย (คนละ endpoint กัน
 * เก็บใน content_reports.writer_note / writer_admin_notices.writer_note คนละคอลัมน์)
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Flag, MessageSquareWarning } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatThaiDateTime } from '@/lib/utils'
import { getReportCategoryLabel } from '@/lib/report-categories'

const PAGE_SIZE = 10

const STATUS_LABEL: Record<string, string> = {
  pending: 'รอตรวจสอบ',
  resolved: 'ปิดเคสแล้ว',
  dismissed: 'ยกเลิกแล้ว',
}
const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  resolved: 'bg-emerald-50 text-emerald-700',
  dismissed: 'bg-destructive/10 text-destructive',
}

interface ReaderReport {
  id: string
  target_type: 'comment' | 'work'
  target: { preview: string | null; work_uuid: string | null; work_title: string | null }
  reason: string
  status: 'pending' | 'resolved' | 'dismissed'
  writer_note: string | null
  writer_acknowledged_at: string | null
  created_at: string
  reported_by: string
}

interface AdminNotice {
  id: string
  subject: string | null
  message: string
  severity: 'normal' | 'risk' | 'critical'
  source: 'work_notice' | 'admin_message' | 'system_action'
  writer_note: string | null
  writer_acknowledged_at: string | null
  created_at: string
  work: { uuid: string; title: string | null } | null
  sender_name: string
}

interface SystemAnnouncement {
  id: string
  title: string
  content: string
  sender_name: string
  created_at: string
}

const NOTICE_SEVERITY: Record<AdminNotice['severity'], { label: string; className: string }> = {
  normal: { label: 'ทั่วไป', className: 'bg-sky-50 text-sky-700' },
  risk: { label: 'มีความเสี่ยง', className: 'bg-amber-50 text-amber-700' },
  critical: { label: 'ร้ายแรง', className: 'bg-red-50 text-red-700' },
}

const NOTICE_SOURCE: Record<AdminNotice['source'], string> = {
  work_notice: 'เกี่ยวกับผลงาน',
  admin_message: 'ข้อความจากแอดมิน',
  system_action: 'เหตุการณ์ระบบ',
}

function AcknowledgeBox({
  existingNote,
  acknowledgedAt,
  onSubmit,
}: {
  existingNote: string | null
  acknowledgedAt: string | null
  onSubmit: (note: string) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [note, setNote] = useState(existingNote ?? '')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!note.trim()) return
    setSubmitting(true)
    try {
      await onSubmit(note.trim())
      setEditing(false)
    } finally {
      setSubmitting(false)
    }
  }

  if (!editing && existingNote) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
        <p className="mb-1 text-xs text-muted-foreground">
          คุณตอบกลับแล้ว{acknowledgedAt ? ` (${formatThaiDateTime(acknowledgedAt)})` : ''}
        </p>
        <p className="text-sm text-foreground">{existingNote}</p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-1 cursor-pointer text-xs font-medium text-primary hover:underline"
        >
          แก้ไขข้อความ
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="ตอบกลับสั้นๆ เพื่อแสดงว่าเห็นแล้ว..."
        className="h-8 min-w-[200px] flex-1 rounded-lg border border-input bg-background px-3 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Button className="h-8 text-xs" disabled={submitting || !note.trim()} onClick={handleSubmit}>
        {submitting ? 'กำลังส่ง...' : 'ส่ง'}
      </Button>
      {existingNote && (
        <Button variant="outline" className="h-8 text-xs" onClick={() => { setEditing(false); setNote(existingNote) }}>
          ยกเลิก
        </Button>
      )}
    </div>
  )
}

function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null
  return (
    <div className="mt-2 flex items-center justify-center gap-3 text-sm text-muted-foreground">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-border disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span>หน้า {page} / {pages}</span>
      <button
        type="button"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-border disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}

function ReaderReportsTab() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['writer', 'reports', page],
    queryFn: () =>
      api.get<{ data: ReaderReport[]; pagination: { page: number; pages: number } }>(
        `/writer/reports?page=${page}&limit=${PAGE_SIZE}`,
      ),
  })

  const rows = query.data?.data ?? []
  const pagination = query.data?.pagination

  async function handleAck(id: string, note: string) {
    try {
      await api.patch(`/writer/reports/${id}/acknowledge`, { note })
      queryClient.invalidateQueries({ queryKey: ['writer', 'reports'] })
      toast.success('ส่งข้อความแล้ว')
    } catch (err: any) {
      toast.error(err?.message ?? 'ส่งไม่สำเร็จ')
    }
  }

  if (query.isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">กำลังโหลด...</p>

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <Flag className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">ยังไม่มีรายงานจากนักอ่าน</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {getReportCategoryLabel('content_error')}
              </span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                {STATUS_LABEL[r.status]}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              รายงานโดย {r.reported_by} · {formatThaiDateTime(r.created_at)}
            </span>
          </div>

          <div className="mb-2 rounded-lg bg-muted/50 p-3 text-sm">
            {r.target_type === 'work' ? (
              <p className="text-foreground">เรื่อง &ldquo;{r.target.work_title ?? r.target.preview}&rdquo;</p>
            ) : (
              <>
                <p className="mb-1 text-xs text-muted-foreground">คอมเมนต์ในเรื่อง &ldquo;{r.target.work_title}&rdquo;</p>
                <p className="text-foreground">{r.target.preview}</p>
              </>
            )}
          </div>

          <p className="mb-3 text-sm text-foreground">รายละเอียด: {r.reason}</p>

          <AcknowledgeBox
            existingNote={r.writer_note}
            acknowledgedAt={r.writer_acknowledged_at}
            onSubmit={(note) => handleAck(r.id, note)}
          />
        </div>
      ))}
      {pagination && <Pager page={pagination.page} pages={pagination.pages} onChange={setPage} />}
    </div>
  )
}

function AdminNoticesTab() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['writer', 'admin-notices', page],
    queryFn: () =>
      api.get<{ data: AdminNotice[]; announcements: SystemAnnouncement[]; pagination: { page: number; pages: number } }>(
        `/writer/admin-notices?page=${page}&limit=${PAGE_SIZE}`,
      ),
  })

  const rows = query.data?.data ?? []
  const announcements = query.data?.announcements ?? []
  const pagination = query.data?.pagination

  async function handleAck(id: string, note: string) {
    try {
      await api.patch(`/writer/admin-notices/${id}/acknowledge`, { note })
      queryClient.invalidateQueries({ queryKey: ['writer', 'admin-notices'] })
      toast.success('ส่งข้อความแล้ว')
    } catch (err: any) {
      toast.error(err?.message ?? 'ส่งไม่สำเร็จ')
    }
  }

  if (query.isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">กำลังโหลด...</p>

  if (rows.length === 0 && announcements.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <MessageSquareWarning className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">ยังไม่มีรายงานจากแอดมิน</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {announcements.length > 0 && (
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <span className="flex size-6 items-center justify-center rounded-full bg-primary/10">i</span>
            ข่าวสารจากระบบ
          </div>
          <div className="flex flex-col gap-2.5">
            {announcements.map((announcement) => (
              <article key={announcement.id} className="rounded-lg border border-primary/15 bg-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{announcement.title}</h3>
                  <span className="text-xs text-muted-foreground">{formatThaiDateTime(announcement.created_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{announcement.content}</p>
                <p className="mt-2 text-xs text-muted-foreground">โดย {announcement.sender_name}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      {rows.map((n) => (
        <div key={n.id} className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{n.subject ?? (n.work ? `เรื่อง “${n.work.title}”` : 'ข้อความจากแอดมิน')}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{NOTICE_SOURCE[n.source]}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${NOTICE_SEVERITY[n.severity].className}`}>{NOTICE_SEVERITY[n.severity].label}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              จาก {n.sender_name} · {formatThaiDateTime(n.created_at)}
            </span>
          </div>

          <p className="mb-3 rounded-lg bg-muted/50 p-3 text-sm text-foreground">{n.message}</p>
          {n.work && <p className="mb-3 text-xs text-muted-foreground">เกี่ยวกับผลงาน “{n.work.title}”</p>}

          <AcknowledgeBox
            existingNote={n.writer_note}
            acknowledgedAt={n.writer_acknowledged_at}
            onSubmit={(note) => handleAck(n.id, note)}
          />
        </div>
      ))}
      {pagination && <Pager page={pagination.page} pages={pagination.pages} onChange={setPage} />}
    </div>
  )
}

export default function WriterReportsPage() {
  const [tab, setTab] = useState<'reader' | 'admin'>('reader')

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">รายงานที่ได้รับ</h1>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => setTab('reader')}
          className={
            tab === 'reader'
              ? 'cursor-pointer rounded-t-[15px] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground'
              : 'cursor-pointer rounded-t-[15px] border border-b-0 border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted'
          }
        >
          รายงานจากนักอ่าน
        </button>
        <button
          type="button"
          onClick={() => setTab('admin')}
          className={
            tab === 'admin'
              ? 'cursor-pointer rounded-t-[15px] bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground'
              : 'cursor-pointer rounded-t-[15px] border border-b-0 border-border bg-background px-5 py-2.5 text-sm font-medium text-foreground hover:bg-muted'
          }
        >
          รายงานจากแอดมิน
        </button>
      </div>

      {tab === 'reader' ? <ReaderReportsTab /> : <AdminNoticesTab />}
    </div>
  )
}
