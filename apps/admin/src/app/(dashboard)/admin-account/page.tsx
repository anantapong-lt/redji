'use client'

/**
 * app/(dashboard)/admin-account/page.tsx — ข้อมูลบัญชีแอดมิน (ข้อ 7 ของสเปค, 2026-08-03)
 *
 * "เนื่องจากแอดมินไม่มีข้อมูลให้โชว์ในเว็บหลัก การดูและปรับแก้ก็ควรอยู่ในเว็บนี้แทน" — ตามสเปค
 * ไม่ต้องสวยงามมาก เน้นดูข้อมูลได้/token
 *
 * ⚠️ 2026-08-03 ย้ายมาจาก "จัดการสิทธิ์" ตามที่ user ยืนยัน: จัดการสิทธิ์เดิมปนกันระหว่างเลื่อนขั้น
 * นักอ่าน↔นักเขียน (1↔6) กับเลื่อนขั้น/จัดการแอดมิน (8/9/10) — "แอดมินไม่ใช่นักเขียน ห้ามไปรวมกัน"
 * ส่วนเลื่อนขั้นแอดมิน + แบน/ปลดแบน + คิวคำขอ 2 คิว (ban-requests/level8-requests) ย้ายมาอยู่ที่นี่
 * ทั้งหมด — "จัดการสิทธิ์" เหลือแค่เลื่อนขั้นนักอ่าน↔นักเขียนแล้ว
 *
 * ส่วน "token" ตามสเปค — ระบบ auth ตอนนี้เป็น JWT ธรรมดา (ไม่มี concept "token ที่ดูย้อนหลังได้"
 * แบบ API key) เลยยังไม่มีอะไรให้โชว์ตรงนี้จริงจัง — คำว่า "token" ในสเปคน่าจะซ้อนกับข้อ 6
 * "หน่วยรบ" ที่พูดถึงการสร้าง token ให้คนช่วยงานเหมือนกัน รอคุยรายละเอียดตอนทำข้อ 6
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Ban } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { api } from '@/lib/api'
import { formatThaiDateTime } from '@/lib/utils'
import { useAdminUser } from '@/store/auth.store'
import type { AdminUserRow, AdminActionRequest, Pagination } from '@/types'

type PendingAction =
  | { type: 'ban_direct'; target: AdminUserRow }
  | { type: 'ban_request'; target: AdminUserRow }
  | { type: 'level8_request'; target: AdminUserRow }

export default function AdminAccountPage() {
  const me = useAdminUser()
  const myLevel = me?.level ?? 0
  const queryClient = useQueryClient()

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [busyUuid, setBusyUuid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [reason, setReason] = useState('')

  const searchQuery = useQuery({
    queryKey: ['admin', 'admin-account-search', search],
    queryFn: () =>
      api.get<{ data: AdminUserRow[]; pagination: Pagination }>(
        `/admin/users?limit=10&min_level=8&search=${encodeURIComponent(search)}`,
      ),
    enabled: search.length > 0,
  })

  const banRequestsQuery = useQuery({
    queryKey: ['admin', 'ban-requests'],
    queryFn: () => api.get<{ data: AdminActionRequest[] }>('/admin/ban-requests?status=pending'),
    enabled: myLevel >= 9,
  })

  const level8RequestsQuery = useQuery({
    queryKey: ['admin', 'level8-requests'],
    queryFn: () => api.get<{ data: AdminActionRequest[] }>('/admin/level8-requests?status=pending'),
    enabled: myLevel >= 10,
  })

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'admin-account-search'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'ban-requests'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'level8-requests'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
  }

  async function handleSetLevel(target: AdminUserRow, level: number) {
    setError(null)
    setBusyUuid(target.uuid)
    try {
      await api.patch(`/admin/users/${target.uuid}/level`, { level })
      invalidateAll()
    } catch (err: any) {
      setError(err?.message ?? 'เปลี่ยน level ไม่สำเร็จ')
    } finally {
      setBusyUuid(null)
    }
  }

  async function handleUnban(target: AdminUserRow) {
    setError(null)
    setBusyUuid(target.uuid)
    try {
      await api.delete(`/admin/users/${target.uuid}/ban`)
      invalidateAll()
    } catch (err: any) {
      setError(err?.message ?? 'ปลดแบนไม่สำเร็จ')
    } finally {
      setBusyUuid(null)
    }
  }

  async function handleConfirmPendingAction() {
    if (!pendingAction || !reason.trim()) return
    setError(null)
    setBusyUuid(pendingAction.target.uuid)
    try {
      if (pendingAction.type === 'ban_direct') {
        await api.post(`/admin/users/${pendingAction.target.uuid}/ban`, { reason: reason.trim() })
      } else if (pendingAction.type === 'ban_request') {
        await api.post('/admin/ban-requests', { target_uuid: pendingAction.target.uuid, reason: reason.trim() })
      } else {
        await api.post('/admin/level8-requests', { target_uuid: pendingAction.target.uuid, reason: reason.trim() })
      }
      invalidateAll()
      setPendingAction(null)
      setReason('')
    } catch (err: any) {
      setError(err?.message ?? 'ทำรายการไม่สำเร็จ')
    } finally {
      setBusyUuid(null)
    }
  }

  async function handleReviewRequest(
    kind: 'ban-requests' | 'level8-requests',
    id: string,
    action: 'approve' | 'reject',
    note?: string,
  ) {
    setError(null)
    try {
      if (action === 'approve') {
        await api.patch(`/admin/${kind}/${id}/approve`, note ? { note } : undefined)
      } else {
        await api.patch(`/admin/${kind}/${id}/reject`, { note })
      }
      invalidateAll()
    } catch (err: any) {
      setError(err?.message ?? 'ดำเนินการไม่สำเร็จ')
    }
  }

  const results = searchQuery.data?.data ?? []

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="mb-6 text-2xl font-bold text-foreground">ข้อมูลบัญชีแอดมิน</h1>

        {/* ข้อมูลบัญชีตัวเอง — เหตุผลของแท็บนี้ตามสเปค: แอดมินไม่มีหน้าโปรไฟล์ในเว็บหลัก */}
        {me && (
          <div className="mb-8 grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-4">
            <InfoRow label="ชื่อที่แสดง" value={me.display_name} />
            <InfoRow label="Username" value={`@${me.u_name}`} />
            <InfoRow label="อีเมล" value={me.email} />
            <InfoRow label="Level" value={String(me.level)} />
            <InfoRow label="UUID" value={me.uuid} />
            <InfoRow label="เป็นแอดมินตั้งแต่" value={formatThaiDateTime(me.created_at)} />
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">จัดการสิทธิ์แอดมิน (level 8/9/10)</h2>

        {error && (
          <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSearch(searchInput.trim())
          }}
          className="mb-4 flex max-w-lg items-end gap-3"
        >
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium text-foreground">ค้นหาผู้ใช้ (แสดงเฉพาะที่ level ≥ 8)</label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="ชื่อบัญชี / ชื่อที่แสดง / อีเมล"
                className="pl-9"
              />
            </div>
          </div>
          <Button type="submit">ค้นหา</Button>
        </form>
        <p className="mb-4 text-xs text-muted-foreground">
          หาไม่เจอ? แปลว่า user นั้นยังเป็น level ต่ำกว่า 8 อยู่ — ปรับเป็นนักอ่าน/นักเขียนได้ที่แท็บ &quot;จัดการสิทธิ์&quot; แทน แล้วค่อยกลับมาตั้งเป็นแอดมินที่นี่
        </p>

        {search && (
          <div className="flex flex-col gap-3">
            {searchQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">กำลังค้นหา...</p>
            ) : results.length === 0 ? (
              <p className="text-sm text-muted-foreground">ไม่พบผู้ใช้ที่ตรงกับคำค้นหา (level ≥ 8)</p>
            ) : (
              results.map((u) => {
                const isSelf = u.uuid === me?.uuid
                const busy = busyUuid === u.uuid
                return (
                  <div
                    key={u.uuid}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
                  >
                    <div>
                      <div className="font-medium text-foreground">
                        {u.display_name} <span className="text-xs text-muted-foreground">@{u.u_name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {u.email} · level {u.level} {u.is_banned && '· ถูกแบนอยู่'}
                      </div>
                    </div>

                    {isSelf ? (
                      <span className="text-xs text-muted-foreground">ไม่สามารถแก้ไข account ตัวเองได้</span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {/* level 10 เท่านั้น: ตั้ง level แอดมินตรงๆ ได้ทุกระดับ */}
                        {myLevel >= 10 && u.level !== 8 && (
                          <Button variant="outline" className="h-8 text-xs" disabled={busy} onClick={() => handleSetLevel(u, 8)}>
                            ตั้งเป็นแอดมินย่อย (8)
                          </Button>
                        )}
                        {myLevel >= 10 && u.level !== 9 && (
                          <Button variant="outline" className="h-8 text-xs" disabled={busy} onClick={() => handleSetLevel(u, 9)}>
                            ตั้งเป็นแอดมินรอง (9)
                          </Button>
                        )}
                        {/* level 9 เท่านั้น (ไม่ใช่ 10): ส่งคำขอเพิ่มเป็นแอดมินย่อย รอ level 10 อนุมัติ */}
                        {myLevel === 9 && u.level !== 8 && (
                          <Button
                            variant="outline"
                            className="h-8 text-xs"
                            disabled={busy}
                            onClick={() => {
                              setError(null)
                              setPendingAction({ type: 'level8_request', target: u })
                              setReason('')
                            }}
                          >
                            ส่งคำขอเพิ่มเป็นแอดมินย่อย
                          </Button>
                        )}

                        {/* แบน/ปลดแบน */}
                        {u.is_banned ? (
                          myLevel >= 9 && (
                            <Button variant="outline" className="h-8 text-xs" disabled={busy} onClick={() => handleUnban(u)}>
                              ปลดแบน
                            </Button>
                          )
                        ) : myLevel >= 9 ? (
                          <Button
                            variant="destructive"
                            className="h-8 text-xs"
                            disabled={busy}
                            onClick={() => {
                              setError(null)
                              setPendingAction({ type: 'ban_direct', target: u })
                              setReason('')
                            }}
                          >
                            <Ban className="size-3" />
                            แบนตรง
                          </Button>
                        ) : (
                          <Button
                            variant="destructive"
                            className="h-8 text-xs"
                            disabled={busy}
                            onClick={() => {
                              setError(null)
                              setPendingAction({ type: 'ban_request', target: u })
                              setReason('')
                            }}
                          >
                            <Ban className="size-3" />
                            ส่งคำขอแบน
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* คิวคำขอแบน — level >= 9 เท่านั้นที่เห็น */}
      {myLevel >= 9 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">คำขอแบนที่รอดำเนินการ</h2>
          <RequestQueue
            requests={banRequestsQuery.data?.data ?? []}
            isLoading={banRequestsQuery.isLoading}
            emptyText="ไม่มีคำขอแบนที่รอดำเนินการ"
            onApprove={(id) => handleReviewRequest('ban-requests', id, 'approve')}
            onReject={(id, note) => handleReviewRequest('ban-requests', id, 'reject', note)}
          />
        </div>
      )}

      {/* คิวคำขอเพิ่มแอดมินย่อย — level >= 10 เท่านั้นที่เห็น */}
      {myLevel >= 10 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-foreground">คำขอเพิ่มแอดมินย่อยที่รอดำเนินการ</h2>
          <RequestQueue
            requests={level8RequestsQuery.data?.data ?? []}
            isLoading={level8RequestsQuery.isLoading}
            emptyText="ไม่มีคำขอเพิ่มแอดมินย่อยที่รอดำเนินการ"
            onApprove={(id) => handleReviewRequest('level8-requests', id, 'approve')}
            onReject={(id, note) => handleReviewRequest('level8-requests', id, 'reject', note)}
          />
        </div>
      )}

      <Modal
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        title={
          pendingAction?.type === 'level8_request'
            ? `ส่งคำขอเพิ่มเป็นแอดมินย่อย: ${pendingAction.target.display_name}`
            : `แบน ${pendingAction?.target.display_name ?? ''}`
        }
      >
        <label className="mb-1.5 block text-sm font-medium text-foreground">เหตุผล</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="mb-4 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="ระบุเหตุผล..."
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setPendingAction(null)}>
            ยกเลิก
          </Button>
          <Button variant="destructive" disabled={!reason.trim()} onClick={handleConfirmPendingAction}>
            ยืนยัน
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-foreground">{value}</div>
    </div>
  )
}

function RequestQueue({
  requests,
  isLoading,
  emptyText,
  onApprove,
  onReject,
}: {
  requests: AdminActionRequest[]
  isLoading: boolean
  emptyText: string
  onApprove: (id: string) => void
  onReject: (id: string, note: string) => void
}) {
  const [notes, setNotes] = useState<Record<string, string>>({})

  if (isLoading) return <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
  if (requests.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>

  return (
    <div className="flex flex-col gap-3">
      {requests.map((r) => (
        <div key={r.id} className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-medium text-foreground">{r.target.display_name}</span>{' '}
              <span className="text-xs text-muted-foreground">@{r.target.u_name} (level {r.target.level})</span>
            </div>
            <span className="text-xs text-muted-foreground">
              ส่งโดย {r.requested_by.display_name} · {formatThaiDateTime(r.created_at)}
            </span>
          </div>
          <p className="mb-3 text-sm text-foreground">เหตุผล: {r.reason}</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={notes[r.id] ?? ''}
              onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
              placeholder="หมายเหตุ (จำเป็นถ้าปฏิเสธ)"
              className="h-8 flex-1 min-w-[180px] rounded-lg border border-input bg-background px-3 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <Button className="h-8 text-xs" onClick={() => onApprove(r.id)}>
              อนุมัติ
            </Button>
            <Button
              variant="destructive"
              className="h-8 text-xs"
              disabled={!notes[r.id]?.trim()}
              onClick={() => onReject(r.id, notes[r.id]?.trim() ?? '')}
            >
              ปฏิเสธ
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
