'use client'

/**
 * app/(dashboard)/squad/page.tsx — "หน่วยรบ" (2026-08-12, ใหม่)
 *
 * ลิสต์บัญชีแอดมิน level 8-10 ทั้งหมด (ทุกคนเห็นทั้งลิสต์ ไม่ใช่แค่ระดับตัวเอง — โปร่งใสทั้งทีม)
 * ล็อกทั้งหน้า level >= 9 เท่านั้น (level 8 เข้าไม่ได้เลย ต่างจากแท็บอื่นส่วนใหญ่ในแอปนี้)
 *
 * รหัสผ่านไม่มีทางดูย้อนหลังได้ (เก็บแค่ argon2 hash) — โชว์ตอนสร้าง/รีเซ็ตครั้งเดียวเท่านั้น ส่วน
 * username/ชื่อ ซ่อนแบบกดลูกตาเปิดดูได้ปกติ (ไม่ใช่เรื่องความปลอดภัย แค่กันเผลอเห็นเวลาแชร์จอ)
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Check, Eye, EyeOff, Plus, ShieldOff, ShieldCheck, KeyRound, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { SquadCreateModal } from '@/components/squad/squad-create-modal'
import { api } from '@/lib/api'
import { formatThaiDateTime } from '@/lib/utils'
import { useAdminUser } from '@/store/auth.store'
import type { SquadAdminRow, SquadHistoryRow, Pagination } from '@/types'

// 2026-08-12 user ขอสี: 8=เขียว, 9=แดง (เดิมเหลือง), 10=ม่วง, 7=เหลืองทอง (ใหม่ — โผล่ในลิสต์นี้
// ตอนบัญชี level 1 ที่สร้างผ่านหน่วยรบถูกตั้งเป็นนักเขียนของเว็บแล้ว), 1=เทาเป็นกลาง (ยังไม่ได้ตั้งอะไร)
const LEVEL_BADGE_CLASS: Record<number, string> = {
  1: 'bg-muted text-muted-foreground',
  7: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300',
  8: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  9: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  10: 'bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
}

const SUB_TABS = [
  { key: 'list', label: 'รายชื่อ' },
  { key: 'history', label: 'ประวัติ' },
] as const
type SubTabKey = (typeof SUB_TABS)[number]['key']

export default function SquadPage() {
  const me = useAdminUser()
  const myLevel = me?.level ?? 0
  const [tab, setTab] = useState<SubTabKey>('list')

  if (myLevel < 9) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-foreground">หน่วยรบ</h1>
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          ต้องเป็นแอดมินรองขึ้นไป (level ≥ 9) ถึงจะเข้าดูแท็บนี้ได้
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">หน่วยรบ</h1>

      <div className="mb-5 flex gap-2.5">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? 'cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground'
                : 'cursor-pointer rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'list' ? <SquadListTab myLevel={myLevel} /> : <SquadHistoryTab />}
    </div>
  )
}

function MaskedField({ value }: { value: string }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="min-w-[7ch] font-mono text-xs text-foreground">
        {revealed ? value : '•'.repeat(Math.min(value.length, 10))}
      </span>
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        aria-label={revealed ? 'ซ่อน' : 'แสดง'}
        className="cursor-pointer text-muted-foreground hover:text-foreground"
      >
        {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="ก็อป"
        className="cursor-pointer text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  )
}

function ResetPasswordResultModal({ password, onClose }: { password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    await navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <Modal open onClose={onClose} title="รีเซ็ตรหัสผ่านสำเร็จ">
      <div className="flex flex-col gap-4">
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          โชว์รหัสผ่านใหม่ให้เห็นแค่ครั้งเดียว ปิดแล้วดูซ้ำไม่ได้อีก ก็อปเก็บไว้ก่อนปิด
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg border border-input bg-muted px-3 py-2 text-sm">{password}</code>
          <Button type="button" variant="outline" onClick={handleCopy} className="h-10 w-10 shrink-0 px-0">
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={onClose}>ปิด (เก็บข้อมูลแล้ว)</Button>
        </div>
      </div>
    </Modal>
  )
}

function SquadListTab({ myLevel }: { myLevel: number }) {
  const queryClient = useQueryClient()
  const [onlyMine, setOnlyMine] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [resetResult, setResetResult] = useState<string | null>(null)
  const [busyUuid, setBusyUuid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'squad-admins', onlyMine],
    queryFn: () =>
      api.get<{ data: SquadAdminRow[]; pagination: Pagination }>(
        `/admin/squad/admins?limit=100${onlyMine ? '&only_mine=true' : ''}`,
      ),
  })

  const rows = query.data?.data ?? []

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'squad-admins'] })
  }

  async function handleSuspend(row: SquadAdminRow) {
    const reason = window.prompt(`ระงับบัญชี "${row.display_name}" — ระบุเหตุผล`)
    if (!reason?.trim()) return
    setError(null)
    setBusyUuid(row.uuid)
    try {
      await api.post(`/admin/squad/admins/${row.uuid}/suspend`, { reason: reason.trim() })
      invalidate()
    } catch (err: any) {
      setError(err?.message ?? 'ระงับไม่สำเร็จ')
    } finally {
      setBusyUuid(null)
    }
  }

  async function handleLift(row: SquadAdminRow) {
    setError(null)
    setBusyUuid(row.uuid)
    try {
      await api.post(`/admin/squad/admins/${row.uuid}/lift-suspension`)
      invalidate()
    } catch (err: any) {
      setError(err?.message ?? 'ยกเลิกการระงับไม่สำเร็จ')
    } finally {
      setBusyUuid(null)
    }
  }

  async function handleDelete(row: SquadAdminRow) {
    const reason = window.prompt(`ลบบัญชี "${row.display_name}" ถาวร — ระบุเหตุผล (ย้อนคืนไม่ได้)`)
    if (!reason?.trim()) return
    if (!window.confirm('ยืนยันลบถาวรจริงหรือไม่?')) return
    setError(null)
    setBusyUuid(row.uuid)
    try {
      await api.post(`/admin/squad/admins/${row.uuid}/delete`, { reason: reason.trim() })
      invalidate()
    } catch (err: any) {
      setError(err?.message ?? 'ลบไม่สำเร็จ')
    } finally {
      setBusyUuid(null)
    }
  }

  async function handleResetPassword(row: SquadAdminRow) {
    if (!window.confirm(`รีเซ็ตรหัสผ่านของ "${row.display_name}" ใหม่หรือไม่? รหัสเดิมจะใช้ไม่ได้อีก`)) return
    setError(null)
    setBusyUuid(row.uuid)
    try {
      const data = await api
        .post<{ data: { password: string } }>(`/admin/squad/admins/${row.uuid}/reset-password`)
        .then((res) => res.data)
      setResetResult(data.password)
    } catch (err: any) {
      setError(err?.message ?? 'รีเซ็ตรหัสผ่านไม่สำเร็จ')
    } finally {
      setBusyUuid(null)
    }
  }

  async function handleEditQuota(row: SquadAdminRow) {
    const input = window.prompt(`ตั้งโควตาสร้างบัญชี level 8 ต่อเดือนของ "${row.display_name}"`, String(row.quota ?? 3))
    if (input === null) return
    const quota = Number(input)
    if (!Number.isInteger(quota) || quota < 0) return
    setError(null)
    setBusyUuid(row.uuid)
    try {
      await api.patch(`/admin/squad/admins/${row.uuid}/quota`, { quota })
      invalidate()
    } catch (err: any) {
      setError(err?.message ?? 'ตั้งโควตาไม่สำเร็จ')
    } finally {
      setBusyUuid(null)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} className="size-4 cursor-pointer" />
          เฉพาะที่ตัวเองสร้าง
        </label>
        <Button type="button" className="rounded-full" onClick={() => setShowCreate(true)}>
          <Plus className="size-4" />
          เพิ่มบัญชีแอดมิน
        </Button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">ระดับ</th>
              <th className="px-4 py-3 font-medium">Username</th>
              <th className="px-4 py-3 font-medium">ชื่อ</th>
              <th className="px-4 py-3 font-medium">สร้างโดย</th>
              <th className="px-4 py-3 font-medium">สร้างเมื่อ</th>
              <th className="px-4 py-3 font-medium">โควตา/เดือน</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">กำลังโหลด...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">ยังไม่มีบัญชีแอดมิน</td></tr>
            ) : (
              rows.map((row) => {
                const canModerate = myLevel > row.level
                const isBusy = busyUuid === row.uuid
                return (
                  <tr key={row.uuid} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${LEVEL_BADGE_CLASS[row.level]}`}>
                        level {row.level}
                      </span>
                    </td>
                    <td className="px-4 py-3"><MaskedField value={row.u_name} /></td>
                    <td className="px-4 py-3"><MaskedField value={row.display_name} /></td>
                    <td className="px-4 py-3 text-muted-foreground">{row.creator?.display_name ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatThaiDateTime(row.created_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.quota === null ? (
                        '—'
                      ) : myLevel >= 10 ? (
                        <button type="button" onClick={() => handleEditQuota(row)} className="cursor-pointer underline decoration-dotted hover:text-foreground">
                          {row.quota} เรื่อง/เดือน
                        </button>
                      ) : (
                        `${row.quota} เรื่อง/เดือน`
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.is_suspended ? (
                        <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">ถูกระงับ</span>
                      ) : (
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">ปกติ</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canModerate && (
                        <div className="flex justify-end gap-1">
                          {row.is_suspended ? (
                            <Button variant="outline" className="h-7 text-xs" disabled={isBusy} onClick={() => handleLift(row)}>
                              <ShieldCheck className="size-3.5" />
                            </Button>
                          ) : (
                            <Button variant="outline" className="h-7 text-xs" disabled={isBusy} onClick={() => handleSuspend(row)}>
                              <ShieldOff className="size-3.5" />
                            </Button>
                          )}
                          <Button variant="outline" className="h-7 text-xs" disabled={isBusy} onClick={() => handleResetPassword(row)}>
                            <KeyRound className="size-3.5" />
                          </Button>
                          <Button variant="destructive" className="h-7 text-xs" disabled={isBusy} onClick={() => handleDelete(row)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <SquadCreateModal
          viewerLevel={myLevel}
          onClose={() => setShowCreate(false)}
          onCreated={invalidate}
        />
      )}
      {resetResult && <ResetPasswordResultModal password={resetResult} onClose={() => setResetResult(null)} />}
    </div>
  )
}

function SquadHistoryTab() {
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['admin', 'squad-history', page],
    queryFn: () =>
      api.get<{ data: SquadHistoryRow[]; pagination: Pagination }>(`/admin/squad/history?page=${page}&limit=30`),
  })

  const rows = query.data?.data ?? []
  const pagination = query.data?.pagination

  const EVENT_LABEL: Record<string, string> = {
    CREATE_SQUAD_ACCOUNT: 'สร้างบัญชี',
    RESET_SQUAD_PASSWORD: 'รีเซ็ตรหัสผ่าน',
    SUSPEND_ACTIVITY: 'ระงับบัญชี',
    LIFT_ACTIVITY_SUSPENSION: 'ยกเลิกการระงับ',
    PERMA_DELETE_USER: 'ลบบัญชีถาวร',
  }

  return (
    <div>
      <div className="flex flex-col gap-3">
        {query.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีประวัติ</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-border bg-card p-4 text-sm">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">{EVENT_LABEL[row.event_type] ?? row.event_type}</span>
                <span className="text-xs text-muted-foreground">{formatThaiDateTime(row.created_at)}</span>
              </div>
              <p className="text-muted-foreground">
                โดย {row.actor?.display_name ?? 'ระบบ'}
                {row.target && ` → ${row.target.display_name} (level ${row.target.level})`}
              </p>
              {row.note && <p className="mt-1 text-xs text-muted-foreground">{row.note}</p>}
            </div>
          ))
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <Button variant="outline" className="h-8 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ก่อนหน้า
          </Button>
          <span>หน้า {pagination.page} / {pagination.pages}</span>
          <Button variant="outline" className="h-8 text-xs" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>
            ถัดไป
          </Button>
        </div>
      )}
    </div>
  )
}
