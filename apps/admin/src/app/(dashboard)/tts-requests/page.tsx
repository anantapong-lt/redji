'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ExternalLink, Loader2, RefreshCw, RotateCcw, Square, Volume2, X } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { formatCompactNumber } from '@/lib/utils'
import { useAdminUser } from '@/store/auth.store'

type Tab = 'approval' | 'queue' | 'history'
type RequestStatus = 'approval' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'rejected'
type TtsRequest = {
  id: string
  requester_type: 'writer' | 'reader' | 'admin' | 'system_update' | 'writer_edit'
  tier: 'basic' | 'pro'
  status: RequestStatus
  requested_at: string
  work: { uuid: string; title: string; view_count: string }
  requester: { type: string; label: string }
  episodes: { id: string; no: number; name: string }[]
  jobs: {
    total: number; by_status: Record<string, number>; completed_blocks: number; total_blocks: number; current_block: number | null; error_message: string | null
    failure_code: string | null; failure_stage: string | null; retryable: boolean; next_retry_at: string | null
  }
  events: { job_id: string; type: string; severity: 'info' | 'warning' | 'error'; code: string | null; message: string; created_at: string }[]
}
type Worker = { online: boolean; last_seen_at: string | null; uptime_seconds: number | null; worker_id: string | null; current_job_id: string | null }

const TABS: { key: Tab; label: string }[] = [
  { key: 'approval', label: 'รออนุมัติ' },
  { key: 'queue', label: 'รอดำเนินการ' },
  { key: 'history', label: 'ประวัติ' },
]
const ACCENT: Record<TtsRequest['requester_type'], string> = {
  reader: 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20',
  writer: 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20',
  admin: 'border-violet-300 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/20',
  system_update: 'border-sky-300 bg-sky-50/60 dark:border-sky-800 dark:bg-sky-950/20',
  writer_edit: 'border-orange-300 bg-orange-50/60 dark:border-orange-800 dark:bg-orange-950/20',
}

function thaiDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
function uptime(seconds: number | null) {
  if (seconds === null) return 'ยังไม่เคยเชื่อมต่อ'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} นาที`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} ชม.`
  return `${Math.floor(seconds / 86400)} วัน`
}

export default function TtsRequestsPage() {
  const user = useAdminUser()
  const [tab, setTab] = useState<Tab>('approval')
  const [historyFilter, setHistoryFilter] = useState<'all' | RequestStatus>('all')
  const [actionId, setActionId] = useState<string | null>(null)
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'tts-requests', tab],
    queryFn: () => api.get<{ data: { worker: Worker; requests: TtsRequest[] } }>(`/admin/tts/overview?tab=${tab}`).then((response) => response.data),
    // A writer request must be visible to Admin promptly even while this tab
    // remains open; 20 seconds made a successfully-created request look lost.
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  })
  const requests = (data?.requests ?? []).filter((request) => historyFilter === 'all' || request.status === historyFilter)

  async function act(id: string, action: 'start' | 'reject' | 'retry' | 'cancel') {
    if (action === 'reject' && !window.confirm('ปฏิเสธคำขอใช้ TTS นี้หรือไม่?')) return
    if (action === 'cancel' && !window.confirm('Cancel the pending or active voice-generation work?')) return
    if (action === 'retry' && !window.confirm('Return failed voice-generation work to the queue?')) return
    setActionId(id)
    try {
      await api.post(`/admin/tts/requests/${id}/${action}`, action === 'reject' ? {} : undefined)
      await refetch()
    } catch (error: any) {
      window.alert(error?.message ?? 'บันทึกคำสั่งไม่สำเร็จ')
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="flex items-center gap-2 text-2xl font-bold text-foreground"><Volume2 className="size-6 text-primary" /> คำขอใช้ TTS</h1><p className="mt-1 text-sm text-muted-foreground">อนุมัติและติดตามงานเสียงบรรยายจากทุกช่องทาง</p></div>
        <div className="flex min-w-60 items-center gap-2 rounded-xl border border-border bg-card px-3 py-3 text-sm">
          <Button type="button" variant="ghost" className="size-9 p-0" onClick={() => refetch()} disabled={isFetching} title="รีเฟรชรายการคำขอ">
            <RefreshCw className={`size-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <div>
          <div className="flex items-center gap-2 font-medium"><span className={`size-2 rounded-full ${data?.worker.online ? 'bg-emerald-500' : 'bg-muted-foreground'}`} /> ระบบสร้างเสียง {data?.worker.online ? 'กำลังเปิดอยู่' : 'ไม่พร้อมใช้งาน'}</div>
          <p className="mt-1 text-xs text-muted-foreground">Uptime: {uptime(data?.worker.uptime_seconds ?? null)} · ล่าสุด {data?.worker.last_seen_at ? thaiDate(data.worker.last_seen_at) : '—'}</p>
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-border">
        {TABS.map((item) => <button key={item.key} type="button" onClick={() => setTab(item.key)} className={`border-b-2 px-3 py-2.5 text-sm font-medium ${tab === item.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{item.label}</button>)}
        {tab === 'history' && <select value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value as typeof historyFilter)} className="ml-auto h-9 rounded-lg border border-input bg-card px-2 text-sm"><option value="all">ทุกสถานะ</option><option value="completed">สำเร็จ</option><option value="failed">ไม่สำเร็จ</option><option value="cancelled">ยกเลิก</option><option value="rejected">ปฏิเสธ</option></select>}
      </div>

      {isLoading ? <div className="py-16 text-center text-sm text-muted-foreground">กำลังโหลดคำขอ TTS...</div> : isError ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">โหลดคำขอ TTS ไม่สำเร็จ <button type="button" onClick={() => refetch()} className="underline">ลองใหม่</button></div> : requests.length === 0 ? <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">ไม่มีรายการในแท็บนี้</div> : <div className="space-y-3">
        {requests.map((request) => {
          const percent = request.jobs.total_blocks > 0 ? Math.round((request.jobs.completed_blocks / request.jobs.total_blocks) * 100) : 0
          return <article key={request.id} className={`rounded-xl border p-4 ${ACCENT[request.requester_type]}`}>
            <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-semibold text-foreground">{request.work.title}</h2><p className="mt-1 text-xs text-muted-foreground">{request.requester.label} · {request.tier === 'pro' ? 'TTS Pro' : 'TTS ธรรมดา'} · ส่งเมื่อ {thaiDate(request.requested_at)}</p></div><Link href={`/works/${request.work.uuid}`} title="เปิดหน้าแก้ไขผลงาน" className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card/80 text-muted-foreground hover:text-foreground"><ExternalLink className="size-4" /></Link></div>
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3"><span>ตอน: {request.episodes.length ? request.episodes.map((episode) => episode.no).join(', ') : '—'}</span><span title={Number(request.work.view_count).toLocaleString('en-US')}>ยอดอ่าน: {formatCompactNumber(request.work.view_count)}</span><span>สถานะ: {request.status === 'processing' ? 'กำลังสร้าง' : request.status === 'queued' ? 'รอคิว' : request.status}</span></div>
            {tab === 'queue' && <div className="mt-3"><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{request.jobs.by_status.processing ? 'กำลังสร้างเสียง' : 'รอ worker รับงาน'}</span><span>{request.jobs.completed_blocks}/{request.jobs.total_blocks} บล็อก ({percent}%)</span></div><div className="h-2 overflow-hidden rounded-full bg-background/80"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} /></div>{request.jobs.error_message && <p className="mt-2 text-xs text-destructive">{request.jobs.error_message}</p>}</div>}
            {tab === 'approval' && <div className="mt-4 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => act(request.id, 'reject')} disabled={actionId === request.id} className="h-8 gap-1 px-3 text-xs"><X className="size-3.5" /> ปฏิเสธ</Button><Button type="button" onClick={() => act(request.id, 'start')} disabled={actionId === request.id} className="h-8 gap-1 px-3 text-xs">{actionId === request.id ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} เริ่ม Gen</Button></div>}
            {tab === 'queue' && (user?.level ?? 0) >= 9 && <div className="mt-3 flex justify-end"><Button type="button" variant="outline" onClick={() => act(request.id, 'cancel')} disabled={actionId === request.id} className="h-8 gap-1 px-3 text-xs"><Square className="size-3.5" /> Cancel job</Button></div>}
            {request.events.length > 0 && <div className="mt-3 space-y-1 border-t border-border/70 pt-3 text-xs">{request.events.map((event) => <p key={`${event.job_id}-${event.created_at}`} className={event.severity === 'error' ? 'text-destructive' : event.severity === 'warning' ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}>{thaiDate(event.created_at)} · {event.code ? `[${event.code}] ` : ''}{event.message}</p>)}</div>}
            {tab === 'history' && (user?.level ?? 0) >= 9 && ['failed', 'cancelled'].includes(request.status) && <div className="mt-4 flex justify-end"><Button type="button" variant="outline" onClick={() => act(request.id, 'retry')} disabled={actionId === request.id} className="h-8 gap-1 px-3 text-xs">{actionId === request.id ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />} Retry failed work</Button></div>}
          </article>
        })}
      </div>}
    </div>
  )
}
