'use client'

/**
 * components/users/user-detail-modal.tsx — หน้าต่างรายละเอียดผู้ใช้ (2026-08-03, ข้อ 2 ของสเปค)
 *
 * ไม่โชว์รูปตามที่ user ขอ ("ไม่แสดงรูปโผล่แต่ชื่อ") แบ่ง 2 ส่วน:
 * - Static: ข้อมูลทั่วไป + login ล่าสุด + เครื่องมือ 4 อย่าง (มุมขวาล่าง) + ปุ่มไปหน้าโปรไฟล์ (ขวาบน)
 * - Dynamic: แท็บสลับได้ (กราฟใช้จ่าย/login/เติมเงิน/คอมเม้น/การอ่าน) แต่ละแท็บ fetch เองตอนเปิดดู
 *   เท่านั้น (enabled: tab === 'x') ไม่ดึงทุกอย่างมาพร้อมกันตอนเปิดหน้าต่าง
 *
 * เครื่องมือ 4 อย่าง: level >= 9 ทำตรงได้เลย (delete ต้อง level 10) level 8 ได้แค่ Flag
 * (ดู action-reason-dialog.tsx — ใช้ component เดียวกันสลับ mode)
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Pause, Play, Wallet, WalletCards, Ban, ShieldCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { ActionReasonDialog } from './action-reason-dialog'
import { api } from '@/lib/api'
import { formatCompactNumber, formatThaiDateTime } from '@/lib/utils'
import { SITE_CONFIG } from '@/site.config'
import { useAdminUser } from '@/store/auth.store'
import type {
  AdminUserDetail, FlagActionType, UserLoginRecord, UserTopupRecord,
  UserCommentRecord, UserReadingRecord, UserSpendingPoint, Pagination,
} from '@/types'

const ACTION_LABEL: Record<FlagActionType, string> = {
  suspend_activity: 'ระงับการเคลื่อนไหว',
  suspend_spending: 'ระงับการใช้จ่ายและเติมเงิน',
  ban: 'แบน',
  delete: 'ลบบัญชีถาวร',
}

const TABS = [
  { key: 'spending', label: 'กราฟใช้จ่าย' },
  { key: 'login', label: 'Login' },
  { key: 'topup', label: 'เติมเงิน' },
  { key: 'comment', label: 'คอมเม้น' },
  { key: 'reading', label: 'การอ่าน' },
] as const
type TabKey = (typeof TABS)[number]['key']

export function UserDetailModal({ uuid, onClose }: { uuid: string | null; onClose: () => void }) {
  const me = useAdminUser()
  const myLevel = me?.level ?? 0
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabKey>('login')
  const [pendingAction, setPendingAction] = useState<FlagActionType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const detailQuery = useQuery({
    queryKey: ['admin', 'user-detail', uuid],
    queryFn: () => api.get<{ data: AdminUserDetail }>(`/admin/users/${uuid}`).then((r) => r.data),
    enabled: !!uuid,
  })

  const user = detailQuery.data

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'user-detail', uuid] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'user-flags'] })
  }

  // เครื่องมือที่ "toggle ได้" (ระงับ 2 แบบ) — ยิง POST ตอนเปิด / DELETE ตอนปิด
  async function toggleSuspension(kind: 'activity' | 'spending', reason?: string) {
    if (!uuid) return
    setError(null)
    setBusy(true)
    try {
      const isActive = kind === 'activity' ? user?.is_activity_suspended : user?.is_spend_suspended
      if (isActive) {
        await api.delete(`/admin/users/${uuid}/suspend-${kind === 'activity' ? 'activity' : 'spending'}`)
      } else {
        await api.post(`/admin/users/${uuid}/suspend-${kind === 'activity' ? 'activity' : 'spending'}`, { reason })
      }
      invalidate()
    } catch (err: any) {
      setError(err?.message ?? 'ทำรายการไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  async function toggleBan(reason?: string) {
    if (!uuid) return
    setError(null)
    setBusy(true)
    try {
      if (user?.is_banned) {
        await api.delete(`/admin/users/${uuid}/ban`)
      } else {
        await api.post(`/admin/users/${uuid}/ban`, { reason })
      }
      invalidate()
    } catch (err: any) {
      setError(err?.message ?? 'ทำรายการไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  async function permaDelete(reason: string) {
    if (!uuid) return
    setError(null)
    setBusy(true)
    try {
      await api.post(`/admin/users/${uuid}/perma-delete`, { reason })
      invalidate()
    } catch (err: any) {
      setError(err?.message ?? 'ทำรายการไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  async function submitFlag(actionType: FlagActionType, reason: string) {
    if (!uuid) return
    setError(null)
    try {
      await api.post(`/admin/users/${uuid}/flag`, { action_type: actionType, reason })
      invalidate()
    } catch (err: any) {
      setError(err?.message ?? 'ส่ง Flag ไม่สำเร็จ')
      throw err
    }
  }

  // ปุ่มไหนต้องเปิด dialog ถามเหตุผลก่อนเสมอ (ระงับ/แบน ตอน "เปิด" + ลบ) ส่วนตอน "ปิด/ปลด" ไม่ต้อง
  // ถามเหตุผล (แค่ยกเลิกสถานะ) — level 8 ทุกปุ่มต้องผ่าน dialog เสมอ (โหมด flag)
  function handleToolClick(actionType: FlagActionType) {
    if (myLevel < 9) {
      setPendingAction(actionType)
      return
    }
    if (actionType === 'delete') {
      setPendingAction('delete')
      return
    }
    // ระงับ/แบน — ถ้ากำลัง active อยู่แล้ว กดคือ "ปลด" ไม่ต้องถามเหตุผล
    const isActive =
      actionType === 'suspend_activity' ? user?.is_activity_suspended :
      actionType === 'suspend_spending' ? user?.is_spend_suspended :
      user?.is_banned
    if (isActive) {
      if (actionType === 'ban') toggleBan()
      else toggleSuspension(actionType === 'suspend_activity' ? 'activity' : 'spending')
      return
    }
    setPendingAction(actionType)
  }

  async function handleDialogSubmit(reason: string) {
    if (!pendingAction) return
    if (myLevel < 9) {
      await submitFlag(pendingAction, reason)
    } else if (pendingAction === 'delete') {
      await permaDelete(reason)
    } else if (pendingAction === 'ban') {
      await toggleBan(reason)
    } else {
      await toggleSuspension(pendingAction === 'suspend_activity' ? 'activity' : 'spending', reason)
    }
    setPendingAction(null)
  }

  if (!uuid) return null

  return (
    <Modal open={!!uuid} onClose={onClose} title="รายละเอียดผู้ใช้" size="xl">
      {detailQuery.isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : !user ? (
        <p className="py-8 text-center text-sm text-destructive">ไม่พบผู้ใช้นี้</p>
      ) : (
        <div className="flex flex-col gap-6">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {/* ── Static ───────────────────────────────────────────────── */}
          <div>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-foreground">
                  {user.display_name} <span className="text-sm font-normal text-muted-foreground">@{user.u_name}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {user.is_deleted && <StatusBadge label="ลบบัญชีถาวรแล้ว" tone="destructive" />}
                  {user.is_banned && <StatusBadge label="ถูกแบน" tone="destructive" />}
                  {user.is_activity_suspended && <StatusBadge label="ระงับการเคลื่อนไหว" tone="destructive" />}
                  {user.is_spend_suspended && <StatusBadge label="ระงับการใช้จ่าย" tone="destructive" />}
                  {!user.is_deleted && !user.is_banned && !user.is_activity_suspended && !user.is_spend_suspended && (
                    <StatusBadge label="ปกติ" tone="success" />
                  )}
                </div>
              </div>
              <a
                href={`${SITE_CONFIG.webUrl}/profile/${user.uuid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                ไปหน้าโปรไฟล์ <ExternalLink className="size-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl border border-border bg-muted/30 p-4 text-sm sm:grid-cols-3">
              <InfoRow label="อีเมล" value={user.email} />
              <InfoRow label="Level" value={String(user.level)} />
              <InfoRow label="อ่าน/เดือน (ตอน)" value={formatCompactNumber(user.reads_month)} />
              <InfoRow label="เหรียญที่ถือ" value={formatCompactNumber(user.point)} />
              <InfoRow label="ใช้ไป/เดือน" value={user.coins_spent_month == null ? '—' : formatCompactNumber(user.coins_spent_month)} />
              <InfoRow label="สมัครเมื่อ" value={formatThaiDateTime(user.created_at)} />
              <InfoRow label="Login ล่าสุด" value={user.last_login_at ? formatThaiDateTime(user.last_login_at) : 'ไม่เคย'} />
              {user.is_banned && <InfoRow label="เหตุผลที่แบน" value={user.ban_reason ?? '—'} />}
              {user.is_activity_suspended && <InfoRow label="เหตุผลระงับการเคลื่อนไหว" value={user.activity_suspended_reason ?? '—'} />}
              {user.is_spend_suspended && <InfoRow label="เหตุผลระงับการใช้จ่าย" value={user.spend_suspended_reason ?? '—'} />}
              {user.is_deleted && <InfoRow label="เหตุผลที่ลบ" value={user.deletion_reason ?? '—'} />}
            </div>

            {!user.is_deleted && (
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button
                  variant={user.is_activity_suspended ? 'outline' : 'destructive'}
                  className="h-8 text-xs"
                  disabled={busy}
                  onClick={() => handleToolClick('suspend_activity')}
                >
                  {user.is_activity_suspended ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                  {user.is_activity_suspended ? 'ยกเลิกระงับการเคลื่อนไหว' : 'ระงับการเคลื่อนไหว'}
                </Button>
                <Button
                  variant={user.is_spend_suspended ? 'outline' : 'destructive'}
                  className="h-8 text-xs"
                  disabled={busy}
                  onClick={() => handleToolClick('suspend_spending')}
                >
                  {user.is_spend_suspended ? <Wallet className="size-3.5" /> : <WalletCards className="size-3.5" />}
                  {user.is_spend_suspended ? 'ยกเลิกระงับใช้จ่าย' : 'ระงับใช้จ่าย+เติมเงิน'}
                </Button>
                <Button
                  variant={user.is_banned ? 'outline' : 'destructive'}
                  className="h-8 text-xs"
                  disabled={busy}
                  onClick={() => handleToolClick('ban')}
                >
                  {user.is_banned ? <ShieldCheck className="size-3.5" /> : <Ban className="size-3.5" />}
                  {user.is_banned ? 'ปลดแบน' : 'แบน'}
                </Button>
                <Button
                  variant="destructive"
                  className="h-8 text-xs"
                  disabled={busy}
                  onClick={() => handleToolClick('delete')}
                >
                  <Trash2 className="size-3.5" />
                  ลบบัญชีถาวร
                </Button>
              </div>
            )}
            {myLevel < 9 && !user.is_deleted && (
              <p className="mt-2 text-right text-xs text-muted-foreground">
                Level 8 ทำรายการเองไม่ได้ ปุ่มด้านบนจะส่งเป็น Flag เข้าคิวแทน
              </p>
            )}
          </div>

          {/* ── Dynamic ──────────────────────────────────────────────── */}
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              {TABS.filter((t) => t.key !== 'spending' || myLevel >= 9).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={
                    tab === t.key
                      ? 'cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'
                      : 'cursor-pointer rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted'
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'spending' && myLevel >= 9 && <SpendingTab uuid={uuid} />}
            {tab === 'login' && <LoginTab uuid={uuid} />}
            {tab === 'topup' && <TopupTab uuid={uuid} />}
            {tab === 'comment' && <CommentTab uuid={uuid} />}
            {tab === 'reading' && <ReadingTab uuid={uuid} />}
          </div>
        </div>
      )}

      <ActionReasonDialog
        open={!!pendingAction}
        mode={myLevel < 9 ? 'flag' : 'direct'}
        actionLabel={pendingAction ? ACTION_LABEL[pendingAction] : ''}
        targetName={user?.display_name ?? ''}
        onClose={() => setPendingAction(null)}
        onSubmit={handleDialogSubmit}
      />
    </Modal>
  )
}

function StatusBadge({ label, tone }: { label: string; tone: 'success' | 'destructive' }) {
  return (
    <span
      className={
        tone === 'success'
          ? 'rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success'
          : 'rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive'
      }
    >
      {label}
    </span>
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

// ── Dynamic tab: กราฟใช้จ่าย (CSS bar chart ล้วนๆ ไม่พึ่ง lib กราฟ — ข้อ 1 (Analytics) ของสเปค
// บอกไว้ว่ากราฟจริงจังรอทำทีหลัง ตัวนี้เป็นกราฟง่ายๆ พอมองเทรนด์ได้ก่อน) ────────────────────────
function SpendingTab({ uuid }: { uuid: string }) {
  const query = useQuery({
    queryKey: ['admin', 'user-spending', uuid],
    queryFn: () => api.get<{ data: UserSpendingPoint[] }>(`/admin/users/${uuid}/spending-series?days=30`).then((r) => r.data),
  })

  const points = query.data ?? []
  const max = Math.max(1, ...points.map((p) => Number(p.amount)))

  if (query.isLoading) return <TabLoading />
  if (points.length === 0) return <TabEmpty text="ไม่มีข้อมูลการใช้จ่ายใน 30 วันที่ผ่านมา" />

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 text-xs text-muted-foreground">ใช้จ่ายรายวัน (30 วันล่าสุด) หน่วย: เหรียญ</div>
      <div className="flex h-40 items-end gap-1">
        {points.map((p) => (
          <div key={p.date} className="group relative flex-1">
            <div
              className="rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
              style={{ height: `${Math.max(2, (Number(p.amount) / max) * 100)}%` }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 rounded bg-foreground px-2 py-1 text-[10px] whitespace-nowrap text-background group-hover:block">
              {formatThaiDateTime(p.date)} — {formatCompactNumber(p.amount)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function LoginTab({ uuid }: { uuid: string }) {
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['admin', 'user-login-records', uuid, page],
    queryFn: () =>
      api.get<{ data: UserLoginRecord[]; pagination: Pagination }>(`/admin/users/${uuid}/login-records?page=${page}&limit=10`),
  })
  const rows = query.data?.data ?? []

  if (query.isLoading) return <TabLoading />
  if (rows.length === 0) return <TabEmpty text="ไม่มีประวัติ login" />

  return (
    <TabTable
      pagination={query.data?.pagination}
      page={page}
      onPageChange={setPage}
      head={['เวลา', 'สถานะ', 'IP', 'User Agent']}
    >
      {rows.map((r) => (
        <tr key={r.id} className="border-b border-border last:border-0">
          <td className="px-3 py-2 text-muted-foreground">{formatThaiDateTime(r.created_at)}</td>
          <td className="px-3 py-2">
            {r.success ? <StatusBadge label="สำเร็จ" tone="success" /> : <StatusBadge label="ไม่สำเร็จ" tone="destructive" />}
          </td>
          <td className="px-3 py-2 text-muted-foreground">{r.ip_address ?? '—'}</td>
          <td className="max-w-[240px] truncate px-3 py-2 text-muted-foreground" title={r.user_agent ?? ''}>
            {r.user_agent ?? '—'}
          </td>
        </tr>
      ))}
    </TabTable>
  )
}

function TopupTab({ uuid }: { uuid: string }) {
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['admin', 'user-topup-records', uuid, page],
    queryFn: () =>
      api.get<{ data: UserTopupRecord[]; pagination: Pagination; capped_to_days: number | null }>(
        `/admin/users/${uuid}/topup-records?page=${page}&limit=10`,
      ),
  })
  const rows = query.data?.data ?? []

  if (query.isLoading) return <TabLoading />

  return (
    <div>
      {query.data?.capped_to_days && (
        <p className="mb-2 text-xs text-muted-foreground">
          * เห็นได้แค่ {query.data.capped_to_days} วันล่าสุด (สิทธิ์ level 8)
        </p>
      )}
      {rows.length === 0 ? (
        <TabEmpty text="ไม่มีประวัติเติมเงิน" />
      ) : (
        <TabTable
          pagination={query.data?.pagination}
          page={page}
          onPageChange={setPage}
          head={['เวลา', 'ช่องทาง', 'จำนวนเงิน', 'เหรียญที่ได้', 'สถานะ']}
        >
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2 text-muted-foreground">{formatThaiDateTime(r.created_at)}</td>
              <td className="px-3 py-2">{r.payment_method}</td>
              <td className="px-3 py-2">{r.amount_paid}</td>
              <td className="px-3 py-2">{r.coins_added}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.status}</td>
            </tr>
          ))}
        </TabTable>
      )}
    </div>
  )
}

function CommentTab({ uuid }: { uuid: string }) {
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['admin', 'user-comment-records', uuid, page],
    queryFn: () =>
      api.get<{ data: UserCommentRecord[]; pagination: Pagination }>(`/admin/users/${uuid}/comment-records?page=${page}&limit=10`),
  })
  const rows = query.data?.data ?? []

  if (query.isLoading) return <TabLoading />
  if (rows.length === 0) return <TabEmpty text="ไม่มีคอมเม้น" />

  return (
    <TabTable pagination={query.data?.pagination} page={page} onPageChange={setPage} head={['เวลา', 'เรื่อง', 'ข้อความ', 'ไลค์']}>
      {rows.map((r) => (
        <tr key={r.id} className="border-b border-border last:border-0">
          <td className="px-3 py-2 text-muted-foreground">{formatThaiDateTime(r.created_at)}</td>
          <td className="px-3 py-2">{r.work.title}</td>
          <td className="max-w-[280px] truncate px-3 py-2" title={r.content}>
            {r.content}
          </td>
          <td className="px-3 py-2 text-muted-foreground">{r.likes_count}</td>
        </tr>
      ))}
    </TabTable>
  )
}

function ReadingTab({ uuid }: { uuid: string }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const query = useQuery({
    queryKey: ['admin', 'user-reading-records', uuid, page, search],
    queryFn: () =>
      api.get<{ data: UserReadingRecord[]; pagination: Pagination }>(
        `/admin/users/${uuid}/reading-records?page=${page}&limit=10${search ? `&work_search=${encodeURIComponent(search)}` : ''}`,
      ),
  })
  const rows = query.data?.data ?? []

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          setSearch(searchInput.trim())
        }}
        className="mb-2 flex max-w-xs gap-2"
      >
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="กรองด้วยชื่อเรื่อง..."
          className="h-8 text-xs"
        />
        <Button type="submit" className="h-8 text-xs">
          กรอง
        </Button>
      </form>

      {query.isLoading ? (
        <TabLoading />
      ) : rows.length === 0 ? (
        <TabEmpty text="ไม่มีประวัติการอ่าน" />
      ) : (
        <TabTable pagination={query.data?.pagination} page={page} onPageChange={setPage} head={['เวลา', 'เรื่อง', 'ตอนที่', 'ซื้อแล้ว']}>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0">
              <td className="px-3 py-2 text-muted-foreground">{formatThaiDateTime(r.created_at)}</td>
              <td className="px-3 py-2">{r.work.title}</td>
              <td className="px-3 py-2">{r.ep_no}</td>
              <td className="px-3 py-2">
                {r.is_purchased ? <StatusBadge label={`ซื้อ (${r.purchase_price})`} tone="success" /> : '—'}
              </td>
            </tr>
          ))}
        </TabTable>
      )}
    </div>
  )
}

function TabLoading() {
  return <p className="py-6 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
}

function TabEmpty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>
}

function TabTable({
  head,
  children,
  pagination,
  page,
  onPageChange,
}: {
  head: string[]
  children: React.ReactNode
  pagination?: Pagination
  page: number
  onPageChange: (page: number) => void
}) {
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              {head.map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {pagination && pagination.pages > 1 && (
        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Button variant="outline" className="h-7 text-xs" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            ก่อนหน้า
          </Button>
          <span>
            {pagination.page} / {pagination.pages}
          </span>
          <Button
            variant="outline"
            className="h-7 text-xs"
            disabled={page >= pagination.pages}
            onClick={() => onPageChange(page + 1)}
          >
            ถัดไป
          </Button>
        </div>
      )}
    </div>
  )
}
