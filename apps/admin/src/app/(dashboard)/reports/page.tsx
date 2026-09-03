'use client'

/**
 * app/(dashboard)/reports/page.tsx — รายงาน (ข้อ 5 ของสเปค)
 *
 * รวม 2 คิวที่เป็น "Ticket" ทั้งคู่แต่มาจากคนละที่ ตามที่ user ยืนยันว่าต้องอยู่แท็บนี้ทั้งคู่:
 * 1. คิวตรวจรายงานเนื้อหา (comment/work) ที่ผู้ใช้กดปุ่ม "รายงาน" มาจาก apps/web
 *    (ดู content_reports, migration 025) — level >= 8 ดู/ปิดเคสได้เลย
 * 2. คิว Flag ผู้ใช้จากหน้า "จัดการผู้ใช้" (migration 027, ระบบ level 8 flag + consensus
 *    threshold) — 2026-08-03 ย้ายมาจากหน้า "จัดการผู้ใช้" ที่เคยแปะผิดที่ไว้ (user ทักว่าต้อง
 *    แยกเป็นแท็บ "รายงาน" ต่างหาก ไม่ใช่ปนอยู่ในหน้าจัดการผู้ใช้)
 *
 * หมายเหตุ: "ปิดเคส (มีมูล)"/"ยกเลิก (ไม่มีมูล)" ของรายงานเนื้อหา แค่ปิดรายการในคิว ไม่ได้ลบ
 * comment/แบน work ให้อัตโนมัติ — ถ้าต้องดำเนินการจริงต้องไปทำผ่านแท็บ "จัดการผู้ใช้"/"ข้อมูลบัญชีแอดมิน" เอง
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { api } from '@/lib/api'
import { formatThaiDateTime } from '@/lib/utils'
import { getReportCategoryLabel } from '@/lib/report-categories'
import { useAdminUser } from '@/store/auth.store'
import type { ContentReportRow, AdminUserFlag, Pagination } from '@/types'

const REPORT_CATEGORY_OPTIONS = [
  { value: 'content_error', label: 'รายงานความผิดพลาด (สะกดผิด, เขียนผิด, แท็กผิด)' },
  { value: 'copyright', label: 'ละเมิดลิขสิทธิ์ / คัดลอกผลงาน' },
  { value: 'unrated_18plus', label: 'มีเนื้อหา 18+ แต่ไม่ติดเรท' },
  { value: 'inappropriate', label: 'เนื้อหาไม่เหมาะสม / ผิดกฎ' },
  { value: 'scam', label: 'หลอกลวง / ลิงก์อันตราย' },
  { value: 'spam', label: 'สแปม / โฆษณา' },
  { value: 'impersonation', label: 'แอบอ้างผู้อื่น' },
  { value: 'harassment', label: 'คุกคาม / กลั่นแกล้ง' },
  { value: 'general', label: 'ปัญหาทั่วไป' },
  { value: 'other', label: 'อื่นๆ' },
]

const STATUS_LABEL: Record<string, string> = {
  pending: 'รอตรวจสอบ',
  resolved: 'ปิดเคส (มีมูล)',
  dismissed: 'ยกเลิก (ไม่มีมูล)',
}

const TARGET_TYPE_LABEL: Record<string, string> = {
  comment: 'ความคิดเห็น',
  work: 'นิยาย',
  user: 'ผู้ใช้',
}

const FLAG_ACTION_LABEL: Record<string, string> = {
  suspend_activity: 'ระงับการเคลื่อนไหว',
  suspend_spending: 'ระงับการใช้จ่าย+เติมเงิน',
  ban: 'แบน',
  delete: 'ลบบัญชีถาวร',
}

export default function ReportsPage() {
  const me = useAdminUser()
  const myLevel = me?.level ?? 0
  const flagQueryClient = useQueryClient()

  const flagsQuery = useQuery({
    queryKey: ['admin', 'user-flags'],
    queryFn: () => api.get<{ data: AdminUserFlag[]; pagination: Pagination }>('/admin/users/flags?status=pending&limit=50'),
  })
  const flags = flagsQuery.data?.data ?? []

  return (
    <div className="flex flex-col gap-10">
      <ContentReportsSection />

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Flag ผู้ใช้ที่รอดำเนินการ</h2>
        {flagsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : flags.length === 0 ? (
          <p className="text-sm text-muted-foreground">ไม่มี Flag ที่รอดำเนินการ</p>
        ) : (
          <FlagQueue
            flags={flags}
            myLevel={myLevel}
            onChanged={() => {
              flagQueryClient.invalidateQueries({ queryKey: ['admin', 'user-flags'] })
              flagQueryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
            }}
          />
        )}
      </div>
    </div>
  )
}

function FlagQueue({
  flags,
  myLevel,
  onChanged,
}: {
  flags: AdminUserFlag[]
  myLevel: number
  onChanged: () => void
}) {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleReview(id: string, action: 'execute' | 'dismiss') {
    setError(null)
    setBusyId(id)
    try {
      const note = notes[id]?.trim()
      if (action === 'execute') {
        await api.patch(`/admin/users/flags/${id}/execute`, note ? { note } : undefined)
      } else {
        await api.patch(`/admin/users/flags/${id}/dismiss`, { note })
      }
      onChanged()
    } catch (err: any) {
      setError(err?.message ?? 'ดำเนินการไม่สำเร็จ')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {flags.map((f) => (
        <div key={f.id} className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-medium text-foreground">{f.target.display_name}</span>{' '}
              <span className="text-xs text-muted-foreground">@{f.target.u_name}</span>{' '}
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                {FLAG_ACTION_LABEL[f.action_type]}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              flag โดย {f.flagged_by.display_name} · {formatThaiDateTime(f.created_at)}
            </span>
          </div>
          <p className="mb-2 text-sm text-foreground">เหตุผล: {f.reason}</p>
          <p className="mb-3 text-xs text-muted-foreground">
            ครบเกณฑ์: {f.pending_count} / {f.threshold} คน
          </p>
          {myLevel >= 9 && (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={notes[f.id] ?? ''}
                onChange={(e) => setNotes((n) => ({ ...n, [f.id]: e.target.value }))}
                placeholder="หมายเหตุ (จำเป็นถ้ายกเลิก)"
                className="h-8 min-w-[180px] flex-1 text-xs"
              />
              <Button className="h-8 text-xs" disabled={busyId === f.id} onClick={() => handleReview(f.id, 'execute')}>
                Execute ทันที
              </Button>
              <Button
                variant="outline"
                className="h-8 text-xs"
                disabled={busyId === f.id || !notes[f.id]?.trim()}
                onClick={() => handleReview(f.id, 'dismiss')}
              >
                ยกเลิก Flag
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function ContentReportsSection() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'pending' | 'resolved' | 'dismissed' | ''>('pending')
  const [targetType, setTargetType] = useState<'comment' | 'work' | 'user' | ''>('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'reports', status, targetType, category],
    queryFn: () =>
      api.get<{ data: ContentReportRow[]; pagination: Pagination }>(
        `/admin/reports?${status ? `status=${status}&` : ''}${targetType ? `target_type=${targetType}&` : ''}${category ? `category=${category}&` : ''}limit=50`,
      ),
  })

  const rows = query.data?.data ?? []

  async function handleReview(id: string, action: 'resolve' | 'dismiss') {
    setError(null)
    setBusyId(id)
    try {
      const note = notes[id]?.trim()
      await api.patch(`/admin/reports/${id}/${action}`, note ? { note } : undefined)
      queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] })
    } catch (err: any) {
      setError(err?.message ?? 'ดำเนินการไม่สำเร็จ')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <h1 className="mb-3 text-2xl font-bold text-foreground">รายงาน</h1>
      <h2 className="mb-3 text-lg font-semibold text-foreground">รายงานเนื้อหา (คอมเม้น/นิยาย)</h2>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-48">
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="">ทั้งหมด</option>
            <option value="pending">รอตรวจสอบ</option>
            <option value="resolved">ปิดเคส (มีมูล)</option>
            <option value="dismissed">ยกเลิก (ไม่มีมูล)</option>
          </Select>
        </div>
        <div className="w-48">
          <Select value={targetType} onChange={(e) => setTargetType(e.target.value as typeof targetType)}>
            <option value="">ทุกประเภท</option>
            <option value="comment">ความคิดเห็น</option>
            <option value="work">นิยาย</option>
            <option value="user">ผู้ใช้</option>
          </Select>
        </div>
        <div className="w-64">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">ทุกหมวดหมู่</option>
            {REPORT_CATEGORY_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">ไม่มีรายงานในสถานะนี้</p>
        ) : (
          rows.map((r) => {
            const busy = busyId === r.id
            return (
              <div key={r.id} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                      {TARGET_TYPE_LABEL[r.target_type]}
                    </span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                      {getReportCategoryLabel(r.category)}
                    </span>
                    <span className="text-xs text-muted-foreground">{STATUS_LABEL[r.status]}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    รายงานโดย {r.reported_by.display_name} · {formatThaiDateTime(r.created_at)}
                  </span>
                </div>

                <div className="mb-2 rounded-lg bg-muted/50 p-3 text-sm">
                  {r.target.exists ? (
                    r.target_type === 'comment' ? (
                      <>
                        <p className="mb-1 text-xs text-muted-foreground">
                          คอมเม้นของ {r.target.author_name} ในเรื่อง &ldquo;{r.target.work_title}&rdquo;
                        </p>
                        <p className="text-foreground">{r.target.preview}</p>
                      </>
                    ) : r.target_type === 'work' ? (
                      <p className="text-foreground">นิยาย &ldquo;{r.target.preview}&rdquo;</p>
                    ) : (
                      <p className="text-foreground">
                        ผู้ใช้ {r.target.preview}{' '}
                        <span className="text-xs text-muted-foreground">@{r.target.u_name}</span>
                      </p>
                    )
                  ) : (
                    <p className="text-muted-foreground italic">เนื้อหานี้ถูกลบไปแล้ว</p>
                  )}
                </div>

                <p className="mb-3 text-sm text-foreground">เหตุผลที่รายงาน: {r.reason}</p>

                {r.status !== 'pending' && r.review_note && (
                  <p className="mb-3 text-sm text-muted-foreground">
                    หมายเหตุจากแอดมิน ({r.reviewed_by_name}): {r.review_note}
                  </p>
                )}

                {r.writer_note && (
                  <p className="mb-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
                    นักเขียนตอบกลับ{r.writer_acknowledged_at ? ` (${formatThaiDateTime(r.writer_acknowledged_at)})` : ''}: {r.writer_note}
                  </p>
                )}

                {r.status === 'pending' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={notes[r.id] ?? ''}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                      placeholder="หมายเหตุ (ไม่บังคับ)"
                      className="h-8 min-w-[180px] flex-1 rounded-lg border border-input bg-background px-3 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    <Button className="h-8 text-xs" disabled={busy} onClick={() => handleReview(r.id, 'resolve')}>
                      ปิดเคส (มีมูล)
                    </Button>
                    <Button
                      variant="outline"
                      className="h-8 text-xs"
                      disabled={busy}
                      onClick={() => handleReview(r.id, 'dismiss')}
                    >
                      ยกเลิก (ไม่มีมูล)
                    </Button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
