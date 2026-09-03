'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, BellRing, History, Megaphone, MessageSquare, Pencil, Send, Trash2, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { api } from '@/lib/api'
import { formatThaiDateTime } from '@/lib/utils'
import { useAdminUser } from '@/store/auth.store'

type Tab = 'announcements' | 'messages' | 'history'
type Severity = 'normal' | 'risk' | 'critical'

interface Announcement {
  id: string
  title: string
  content: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  created_by_name: string
}

interface Recipient {
  uuid: string
  display_name: string
  u_name: string
  work_count: number
}

interface WriterMessageHistory {
  id: string
  subject: string | null
  message: string
  severity: Severity
  source: 'work_notice' | 'admin_message' | 'system_action'
  created_at: string
  sender_name: string
  recipient: { uuid: string; display_name: string; u_name: string }
  work: { uuid: string; title: string | null } | null
  writer_note: string | null
  writer_acknowledged_at: string | null
}

const SEVERITY_CONFIG: Record<Severity, { label: string; className: string }> = {
  normal: { label: 'ทั่วไป', className: 'border-sky-200 bg-sky-50 text-sky-700' },
  risk: { label: 'มีความเสี่ยง', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  critical: { label: 'ร้ายแรง', className: 'border-red-200 bg-red-50 text-red-700' },
}

const SOURCE_LABEL: Record<WriterMessageHistory['source'], string> = {
  admin_message: 'ข้อความถึงนักเขียน',
  work_notice: 'ข้อความเกี่ยวกับผลงาน',
  system_action: 'เหตุการณ์อัตโนมัติ',
}

function TabButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof Megaphone; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active
        ? 'inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm'
        : 'inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted'}
    >
      <Icon className="size-4" />
      {label}
    </button>
  )
}

function StatusPill({ severity }: { severity: Severity }) {
  const item = SEVERITY_CONFIG[severity]
  return <span className={'rounded-full border px-2.5 py-1 text-xs font-semibold ' + item.className}>{item.label}</span>
}

function AnnouncementPanel() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [saving, setSaving] = useState(false)

  const announcementsQuery = useQuery({
    queryKey: ['admin', 'announcements', 'all'],
    queryFn: () => api.get<{ data: Announcement[] }>('/admin/announcements?all=true'),
  })

  function resetForm() {
    setEditing(null)
    setTitle('')
    setContent('')
    setStatus('active')
  }

  function startEdit(item: Announcement) {
    setEditing(item)
    setTitle(item.title)
    setContent(item.content)
    setStatus(item.status)
  }

  async function save() {
    if (!title.trim() || !content.trim()) {
      window.alert('กรุณากรอกหัวข้อและเนื้อหาข่าวสาร')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await api.patch('/admin/announcements/' + editing.id, { title: title.trim(), content: content.trim(), status })
        window.alert('บันทึกข่าวสารแล้ว')
      } else {
        await api.post('/admin/announcements', { title: title.trim(), content: content.trim(), status })
        window.alert(status === 'active' ? 'เผยแพร่ข่าวสารแล้ว' : 'บันทึกร่างข่าวสารแล้ว')
      }
      resetForm()
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] })
    } catch (error: any) {
      window.alert(error?.message ?? 'บันทึกข่าวสารไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function setAnnouncementStatus(item: Announcement, nextStatus: 'active' | 'inactive') {
    try {
      await api.patch('/admin/announcements/' + item.id, { status: nextStatus })
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] })
      window.alert(nextStatus === 'active' ? 'เผยแพร่ข่าวสารแล้ว' : 'ซ่อนข่าวสารแล้ว')
    } catch (error: any) {
      window.alert(error?.message ?? 'เปลี่ยนสถานะไม่สำเร็จ')
    }
  }

  async function removeAnnouncement(item: Announcement) {
    if (!window.confirm('ลบข่าวสาร “' + item.title + '” ใช่หรือไม่?')) return
    try {
      await api.delete('/admin/announcements/' + item.id)
      queryClient.invalidateQueries({ queryKey: ['admin', 'announcements'] })
      if (editing?.id === item.id) resetForm()
      window.alert('ลบข่าวสารแล้ว')
    } catch (error: any) {
      window.alert(error?.message ?? 'ลบข่าวสารไม่สำเร็จ')
    }
  }

  const rows = announcementsQuery.data?.data ?? []

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">{editing ? 'แก้ไขข่าวสาร' : 'โพสต์ข่าวสารใหม่'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">ข่าวสารที่เผยแพร่จะแสดงในหมวดข่าวสาร และในรายงานจากแอดมินของนักเขียนทุกคน</p>
          </div>
          <Megaphone className="mt-0.5 size-5 text-primary" />
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">หัวข้อ</label>
            <Input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} placeholder="เช่น แจ้งกำหนดการปรับปรุงระบบ" />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label className="block text-sm font-medium text-foreground">รายละเอียด</label>
              <span className="text-xs text-muted-foreground">{content.length}/5000</span>
            </div>
            <textarea
              value={content}
              maxLength={5000}
              onChange={(event) => setContent(event.target.value)}
              placeholder="พิมพ์ข้อความที่ต้องการแจ้งนักเขียน..."
              className="min-h-40 w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">การเผยแพร่</label>
            <Select value={status} onChange={(event) => setStatus(event.target.value as 'active' | 'inactive')}>
              <option value="active">เผยแพร่ทันที</option>
              <option value="inactive">บันทึกเป็นฉบับร่าง</option>
            </Select>
          </div>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            {editing && <Button variant="outline" onClick={resetForm}>ยกเลิก</Button>}
            <Button disabled={saving} onClick={save}>
              <Send className="size-4" />
              {saving ? 'กำลังบันทึก...' : editing ? 'บันทึกการแก้ไข' : 'บันทึกข่าวสาร'}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-foreground">ข่าวสารทั้งหมด</h2>
            <p className="mt-1 text-sm text-muted-foreground">เก็บประวัติทั้งที่เผยแพร่และฉบับร่าง</p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{rows.length}</span>
        </div>
        {announcementsQuery.isLoading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">กำลังโหลดข่าวสาร...</p>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">ยังไม่มีข่าวสาร</p>
        ) : (
          <div className="max-h-[580px] space-y-3 overflow-y-auto pr-1">
            {rows.map((item) => (
              <article key={item.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">โดย {item.created_by_name} · {formatThaiDateTime(item.created_at)}</p>
                  </div>
                  <span className={item.status === 'active' ? 'shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700' : 'shrink-0 rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground'}>
                    {item.status === 'active' ? 'เผยแพร่' : 'ฉบับร่าง'}
                  </span>
                </div>
                <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-foreground">{item.content}</p>
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => startEdit(item)}><Pencil className="size-3.5" />แก้ไข</Button>
                  <Button variant="outline" className="h-8 px-3 text-xs" onClick={() => setAnnouncementStatus(item, item.status === 'active' ? 'inactive' : 'active')}>
                    {item.status === 'active' ? 'ซ่อน' : 'เผยแพร่'}
                  </Button>
                  <Button variant="ghost" className="h-8 px-3 text-xs text-destructive hover:text-destructive" onClick={() => removeAnnouncement(item)}><Trash2 className="size-3.5" />ลบ</Button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function DirectMessagePanel() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [recipientUuid, setRecipientUuid] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [severity, setSeverity] = useState<Severity>('normal')
  const [sending, setSending] = useState(false)

  const recipientsQuery = useQuery({
    queryKey: ['admin', 'writer-message-recipients', search],
    queryFn: () => api.get<{ data: Recipient[] }>('/admin/writer-message-recipients?search=' + encodeURIComponent(search)),
  })
  const recipients = recipientsQuery.data?.data ?? []
  const selectedRecipient = recipients.find((item) => item.uuid === recipientUuid)

  async function send() {
    if (!recipientUuid || !subject.trim() || !message.trim()) {
      window.alert('กรุณาเลือกผู้รับและกรอกหัวข้อกับรายละเอียด')
      return
    }
    setSending(true)
    try {
      await api.post('/admin/writer-messages', {
        writer_uuid: recipientUuid,
        subject: subject.trim(),
        message: message.trim(),
        severity,
      })
      setSubject('')
      setMessage('')
      setSeverity('normal')
      window.alert('ส่งข้อความถึงนักเขียนแล้ว')
      queryClient.invalidateQueries({ queryKey: ['admin', 'writer-message-history'] })
    } catch (error: any) {
      window.alert(error?.message ?? 'ส่งข้อความไม่สำเร็จ')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-6 flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><MessageSquare className="size-5" /></div>
        <div>
          <h2 className="font-semibold text-foreground">ส่งข้อความถึงนักเขียน</h2>
          <p className="mt-1 text-sm text-muted-foreground">ข้อความนี้จะส่งตรงไปที่ นักเขียน &gt; รายงานที่ได้รับ &gt; รายงานจากแอดมิน</p>
        </div>
      </div>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">ค้นหานักเขียน</label>
          <Input value={search} onChange={(event) => { setSearch(event.target.value); setRecipientUuid('') }} placeholder="ชื่อที่แสดง, username หรืออีเมล" />
          <div className="mt-2">
            <Select value={recipientUuid} onChange={(event) => setRecipientUuid(event.target.value)} disabled={recipientsQuery.isLoading}>
              <option value="">{recipientsQuery.isLoading ? 'กำลังค้นหา...' : 'เลือกนักเขียนผู้รับ'}</option>
              {recipients.map((recipient) => <option key={recipient.uuid} value={recipient.uuid}>{recipient.display_name} (@{recipient.u_name}) · {recipient.work_count} ผลงาน</option>)}
            </Select>
          </div>
          {selectedRecipient && <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><UserRound className="size-3.5" />ผู้รับ: {selectedRecipient.display_name} (@{selectedRecipient.u_name})</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">หัวข้อ</label>
            <Input value={subject} maxLength={200} onChange={(event) => setSubject(event.target.value)} placeholder="เช่น ขอให้ตรวจสอบข้อมูลผลงาน" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">ระดับความเร่งด่วน</label>
            <Select value={severity} onChange={(event) => setSeverity(event.target.value as Severity)}>
              <option value="normal">ทั่วไป</option>
              <option value="risk">มีความเสี่ยง</option>
              <option value="critical">ร้ายแรง</option>
            </Select>
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label className="block text-sm font-medium text-foreground">รายละเอียด</label>
            <span className="text-xs text-muted-foreground">{message.length}/5000</span>
          </div>
          <textarea value={message} maxLength={5000} onChange={(event) => setMessage(event.target.value)} placeholder="อธิบายรายละเอียด เหตุผล หรือสิ่งที่ต้องดำเนินการ..." className="min-h-48 w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/30" />
        </div>
        {severity === 'critical' && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" />ข้อความร้ายแรงควรระบุสาเหตุและการดำเนินการที่ชัดเจน เช่น การละเมิดสิทธิ์หรือการนำผลงานออกจากระบบ</div>}
        <div className="flex justify-end"><Button disabled={sending} onClick={send}><Send className="size-4" />{sending ? 'กำลังส่ง...' : 'ส่งข้อความถึงนักเขียน'}</Button></div>
      </div>
    </section>
  )
}

type HistoryFilter = 'all' | 'new' | 'old' | 'unanswered'

const NEW_THRESHOLD_DAYS = 7 // เกณฑ์ "ใหม่" เท่ากับหน้าประวัติการอ่านฝั่ง apps/web (สัปดาห์นี้)

const HISTORY_FILTERS: { key: HistoryFilter; label: string }[] = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'new', label: 'ข้อความใหม่' },
  { key: 'old', label: 'ข้อความเก่า' },
  { key: 'unanswered', label: 'ยังไม่ได้ตอบ' },
]

const HISTORY_EMPTY_LABEL: Record<HistoryFilter, string> = {
  all: 'ยังไม่มีประวัติการสื่อสาร',
  new: 'ไม่มีข้อความใหม่ในช่วง 7 วันล่าสุด',
  old: 'ไม่มีข้อความเก่ากว่า 7 วัน',
  unanswered: 'ไม่มีข้อความที่รอนักเขียนตอบ',
}

function HistoryPanel() {
  const [filter, setFilter] = useState<HistoryFilter>('all')

  const noticesQuery = useQuery({
    queryKey: ['admin', 'writer-message-history'],
    queryFn: () => api.get<{ data: WriterMessageHistory[] }>('/admin/writer-message-history?limit=100'),
  })
  const announcementsQuery = useQuery({
    queryKey: ['admin', 'announcements', 'all'],
    queryFn: () => api.get<{ data: Announcement[] }>('/admin/announcements?all=true'),
  })

  const allItems = useMemo(() => {
    const messages = (noticesQuery.data?.data ?? []).map((item) => ({ kind: 'message' as const, createdAt: item.created_at, item }))
    const announcements = (announcementsQuery.data?.data ?? []).map((item) => ({ kind: 'announcement' as const, createdAt: item.created_at, item }))
    return [...messages, ...announcements].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [announcementsQuery.data?.data, noticesQuery.data?.data])

  // "ยังไม่ได้ตอบ" ใช้ได้แค่กับข้อความถึงนักเขียนโดยตรง (kind='message') เท่านั้น — ข่าวสารถึง
  // ทุกคนเป็นการกระจายเสียงทางเดียว ไม่มี concept "ตอบ" ให้เช็ค (writer_note) เลยไม่ถูกนับว่า
  // ตอบแล้ว/ยังไม่ตอบทั้งคู่ กรองแล้วจะไม่โผล่ในหมวดนี้เลย
  const items = useMemo(() => {
    if (filter === 'all') return allItems
    const cutoff = Date.now() - NEW_THRESHOLD_DAYS * 24 * 60 * 60 * 1000
    if (filter === 'new') return allItems.filter((entry) => new Date(entry.createdAt).getTime() >= cutoff)
    if (filter === 'old') return allItems.filter((entry) => new Date(entry.createdAt).getTime() < cutoff)
    // unanswered
    return allItems.filter((entry) => entry.kind === 'message' && !entry.item.writer_note)
  }, [allItems, filter])

  if (noticesQuery.isLoading || announcementsQuery.isLoading) return <p className="py-16 text-center text-sm text-muted-foreground">กำลังโหลดประวัติ...</p>

  return (
    <section className="mx-auto w-full max-w-4xl">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><History className="size-5" /></div>
        <div>
          <h2 className="font-semibold text-foreground">ประวัติการสื่อสาร</h2>
          <p className="mt-1 text-sm text-muted-foreground">รวมข่าวสาร ข้อความถึงนักเขียน และเหตุการณ์ที่ระบบแจ้งโดยอัตโนมัติ</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {HISTORY_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={filter === f.key
              ? 'cursor-pointer rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground'
              : 'cursor-pointer rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted'}
          >
            {f.label}
          </button>
        ))}
      </div>

      {items.length === 0 ? <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center text-sm text-muted-foreground">{HISTORY_EMPTY_LABEL[filter]}</div> : (
        <div className="space-y-3">
          {items.map((entry) => entry.kind === 'announcement' ? (
            <article key={'announcement-' + entry.item.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">ข่าวสารถึงทุกคน</span><span className={entry.item.status === 'active' ? 'text-xs font-medium text-emerald-700' : 'text-xs font-medium text-muted-foreground'}>{entry.item.status === 'active' ? 'เผยแพร่' : 'ฉบับร่าง'}</span></div>
                <span className="text-xs text-muted-foreground">{formatThaiDateTime(entry.item.created_at)}</span>
              </div>
              <h3 className="mt-3 font-semibold text-foreground">{entry.item.title}</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{entry.item.content}</p>
              <p className="mt-3 text-xs text-muted-foreground">โดย {entry.item.created_by_name}</p>
            </article>
          ) : (
            <article key={'notice-' + entry.item.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">{SOURCE_LABEL[entry.item.source]}</span><StatusPill severity={entry.item.severity} /></div>
                <span className="text-xs text-muted-foreground">{formatThaiDateTime(entry.item.created_at)}</span>
              </div>
              <h3 className="mt-3 font-semibold text-foreground">{entry.item.subject ?? (entry.item.work ? 'ข้อความเกี่ยวกับผลงาน: ' + entry.item.work.title : 'ข้อความจากผู้ดูแล')}</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{entry.item.message}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground"><span>ถึง {entry.item.recipient.display_name} (@{entry.item.recipient.u_name})</span><span>ผู้ส่ง: {entry.item.sender_name}</span>{entry.item.work && <span>ผลงาน: {entry.item.work.title}</span>}{entry.item.writer_note && <span>นักเขียนตอบแล้ว</span>}</div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default function MessagesPage() {
  const user = useAdminUser()
  const [tab, setTab] = useState<Tab>('announcements')
  const isDeputyAdmin = (user?.level ?? 0) >= 9

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-primary">WRITER COMMUNICATIONS</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">ข้อความ</h1>
          <p className="mt-1 text-sm text-muted-foreground">สื่อสารกับนักเขียนและเก็บร่องรอยการแจ้งเตือนไว้ในที่เดียว</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground"><BellRing className="size-4 text-primary" />ผู้ส่งข่าวสารและข้อความ: Admin รองขึ้นไป</div>
      </div>

      {!isDeputyAdmin ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">หน้าข้อความสำหรับส่งถึงนักเขียนต้องใช้สิทธิ์ Admin รอง (level 9) ขึ้นไป</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2"><TabButton active={tab === 'announcements'} icon={Megaphone} label="ข่าวสาร" onClick={() => setTab('announcements')} /><TabButton active={tab === 'messages'} icon={MessageSquare} label="ข้อความ" onClick={() => setTab('messages')} /><TabButton active={tab === 'history'} icon={History} label="ประวัติ" onClick={() => setTab('history')} /></div>
          {tab === 'announcements' && <AnnouncementPanel />}
          {tab === 'messages' && <DirectMessagePanel />}
          {tab === 'history' && <HistoryPanel />}
        </>
      )}
    </div>
  )
}
