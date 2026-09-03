'use client'

/**
 * app/(dashboard)/writers/page.tsx — นักเขียน
 *
 * 3 แท็บย่อย (เดิม 2 แท็บ — เพิ่ม "เพิ่มนักเขียนของเว็บ" มติ 2026-08-10):
 * - "นักเขียนทั้งหมด" (เดิมชื่อ "นักเขียนของเว็บ" — เปลี่ยนชื่อให้ตรงความหมายมากขึ้นตอนแยก level 7
 *   ออกมาเป็นแท็บของตัวเอง) — เกณฑ์เดิม (2026-08-04): (level 6-7) OR มีผลงานอัพโหลดจริงแล้ว
 *   (status active อย่างน้อย 1 เรื่อง) — เพิ่มตัวกรอง ทั้งหมด/อิสระ (level 6 เท่านั้น)/นักเขียนของเว็บ
 *   (level 7 เท่านั้น) โดย "อิสระ"/"นักเขียนของเว็บ" กรองด้วย `level` ตรงๆ (exact match) แทน
 *   `writers_only` — ใช้ query param `writers_only=true` เฉพาะตัวกรอง "ทั้งหมด" (ดู listUsers
 *   ใน admin.service.ts ฝั่ง backend)
 * - approve คำขอของตัวเองไม่ได้ (CANNOT_APPROVE_SELF จาก backend) ต้องให้แอดมินอีกคนกดให้
 * - "รอยืนยันสิทธิ์" — คำขอจากฟอร์ม /writer/info จริง (ตาราง user_detail ผ่าน
 *   GET /admin/writer-applications) กดดูรายละเอียดทุกช่องที่ส่งมาได้ + อนุมัติ/ปฏิเสธ
 *   (level >= 8 ทำได้เลย ไม่ต้องขอสิทธิ์เพิ่ม — เป็นหน้าที่หลักของ "อนุมัติคน")
 * - "เพิ่มนักเขียนของเว็บ" (ใหม่, 2026-08-10) — เลือกจากบัญชี level 7 ที่มีอยู่แล้ว (ตั้ง level
 *   ผ่านหน้า "ผู้ใช้" ปกติ ไม่ได้สร้างบัญชีใหม่ตรงนี้) แล้วอัพนิยายแทนบัญชีนั้นได้ (เดี่ยว/หลายเรื่องพร้อมกัน)
 *   ดู components/writers/house-writers-tab.tsx
 *
 * 2026-08-04: ปุ่ม "ถอดสถานะนักเขียน" ย้ายเข้าไปอยู่ในปุ่ม "ดูเพิ่มเติม" ต่อแถวของตาราง
 * "นักเขียนของเว็บ" นี้แทน (เดิมอยู่แท็บ "จัดการสิทธิ์" ที่ตัดทิ้งไปแล้ว → ย้ายมาเป็นปุ่มเดี่ยวในตาราง
 * รอบก่อน → ตอนนี้ user ขอรวมเข้ากับ "ดูเพิ่มเติม" ที่โชว์ข้อมูลใบสมัคร + รายชื่อผลงานด้วย ดู
 * components/writers/writer-detail-modal.tsx) เลื่อนขั้นเป็นนักเขียน (1→6) ทำได้ทางเดียวผ่าน
 * ใบสมัครจริงที่แท็บ "รอยืนยันสิทธิ์" เท่านั้น ไม่มีทาง bypass ตั้งตรงๆ แบบไม่มีข้อมูลบัญชีธนาคารอีกต่อไป
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Library, Users, UserPlus, BookOpen, Bookmark, Heart, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Modal } from '@/components/ui/modal'
import { WriterDetailModal } from '@/components/writers/writer-detail-modal'
import { HouseWritersTab } from '@/components/writers/house-writers-tab'
import { api } from '@/lib/api'
import { formatCompactNumber, formatThaiDateTime } from '@/lib/utils'
import { useAdminUser } from '@/store/auth.store'
import type { AdminUserRow, WriterApplicationRow, Pagination } from '@/types'

// คอลัมน์สถิติเพิ่มเติม (2026-08-04 user ขอ) — ตัวเลขเดียวกับที่หน้าโปรไฟล์เว็บโชว์ (มุมมองนักเขียน
// รวมจากผลงานทั้งหมด) บวก "จำนวนผลงาน" ที่ฝั่งโปรไฟล์เว็บไม่มีโชว์ ไอคอนอ้างอิงจาก
// apps/web/src/components/profile/profile-header.tsx ให้เห็นภาพตรงกันข้ามหน้าเว็บจริง
const WRITER_STAT_COLUMNS: { key: keyof AdminUserRow; label: string; icon: typeof Library }[] = [
  { key: 'work_count', label: 'จำนวนผลงาน', icon: Library },
  { key: 'follower_count', label: 'ผู้ติดตาม', icon: Users },
  { key: 'following_count', label: 'กำลังติดตาม', icon: UserPlus },
  { key: 'read_count', label: 'อ่านแล้ว', icon: BookOpen },
  { key: 'bookmark_count', label: 'เก็บเข้าคลัง', icon: Bookmark },
  { key: 'favorite_count', label: 'หัวใจ', icon: Heart },
  { key: 'comment_count', label: 'ความคิดเห็น', icon: MessageCircle },
]

const SUB_TABS = [
  { key: 'approved', label: 'นักเขียนทั้งหมด' },
  { key: 'applications', label: 'รอยืนยันสิทธิ์' },
  { key: 'house', label: 'เพิ่มนักเขียนของเว็บ' },
] as const
type SubTabKey = (typeof SUB_TABS)[number]['key']

export default function WritersPage() {
  const [tab, setTab] = useState<SubTabKey>('approved')

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">นักเขียน</h1>

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

      {tab === 'approved' ? <ApprovedWritersTab /> : tab === 'applications' ? <ApplicationsTab /> : <HouseWritersTab />}
    </div>
  )
}

// ตัวกรอง "ทั้งหมด/อิสระ/นักเขียนของเว็บ" — "อิสระ"/"นักเขียนของเว็บ" กรองด้วย level ตรงๆ (exact
// match ผ่าน query param level=6/level=7 ของ GET /admin/users เดิม) "ทั้งหมด" ใช้ writers_only
// เหมือนเดิม (level 6-7 OR มีผลงานจริง) ไม่ต้องแก้ backend เลยสักจุด
const WRITER_FILTER_OPTIONS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'independent', label: 'อิสระ' },
  { key: 'house', label: 'นักเขียนของเว็บ' },
] as const
type WriterFilterKey = (typeof WRITER_FILTER_OPTIONS)[number]['key']

function ApprovedWritersTab() {
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<WriterFilterKey>('all')
  const [viewingUser, setViewingUser] = useState<AdminUserRow | null>(null)

  const filterQuery = filter === 'independent' ? 'level=6' : filter === 'house' ? 'level=7' : 'writers_only=true'

  const query = useQuery({
    queryKey: ['admin', 'writers-approved', filter, page],
    queryFn: () =>
      api.get<{ data: AdminUserRow[]; pagination: Pagination }>(
        `/admin/users?${filterQuery}&page=${page}&limit=20`,
      ),
  })

  const rows = query.data?.data ?? []
  const pagination = query.data?.pagination

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {WRITER_FILTER_OPTIONS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => {
              setFilter(f.key)
              setPage(1)
            }}
            className={
              filter === f.key
                ? 'cursor-pointer rounded-full bg-foreground px-3.5 py-1.5 text-xs font-medium text-background'
                : 'cursor-pointer rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted'
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">นักเขียน</th>
              <th className="px-4 py-3 font-medium">อีเมล</th>
              <th className="px-4 py-3 font-medium">ยอดขายสะสม</th>
              {WRITER_STAT_COLUMNS.map((c) => (
                <th key={c.key} className="px-4 py-3 font-medium whitespace-nowrap">
                  <span className="flex items-center gap-1">
                    <c.icon className="size-3.5" />
                    {c.label}
                  </span>
                </th>
              ))}
              <th className="px-4 py-3 font-medium whitespace-nowrap">เป็นนักเขียนตั้งแต่</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={5 + WRITER_STAT_COLUMNS.length} className="px-4 py-8 text-center text-muted-foreground">
                  กำลังโหลด...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5 + WRITER_STAT_COLUMNS.length} className="px-4 py-8 text-center text-muted-foreground">
                  ยังไม่มีนักเขียนในระบบ
                </td>
              </tr>
            ) : (
              rows.map((u) => (
                <tr key={u.uuid} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{u.display_name}</div>
                    <div className="text-xs text-muted-foreground">@{u.u_name}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3" title={Number(u.sales).toLocaleString('en-US')}>{formatCompactNumber(u.sales)}</td>
                  {WRITER_STAT_COLUMNS.map((c) => (
                    <td key={c.key} className="px-4 py-3" title={String((u[c.key] as number | undefined) ?? 0)}>
                      {formatCompactNumber((u[c.key] as number | undefined) ?? 0)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatThaiDateTime(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <Button variant="outline" className="h-7 text-xs" onClick={() => setViewingUser(u)}>
                      ดูเพิ่มเติม
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <Button variant="outline" className="h-8 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ก่อนหน้า
          </Button>
          <span>หน้า {pagination.page} / {pagination.pages}</span>
          <Button
            variant="outline"
            className="h-8 text-xs"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            ถัดไป
          </Button>
        </div>
      )}

      <WriterDetailModal user={viewingUser} onClose={() => setViewingUser(null)} />
    </div>
  )
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'รอตรวจสอบ',
  approve: 'อนุมัติแล้ว',
  rejected: 'ปฏิเสธแล้ว',
}

// แยกประเภทคำขอให้เห็นชัดเจน (2026-08-18 user ขอ) — "ขอเป็นนักเขียนใหม่" เลื่อน level 1→6 ตอนอนุมัติ
// ส่วน "แก้ไขข้อมูล" คือของนักเขียนที่อนุมัติแล้วมาแก้ไขข้อมูลเดิม (ไม่แตะ level เลย) — สีต่างกันให้
// แยกออกจากไกลๆ ในลิสต์ได้ทันที
const TYPE_LABEL: Record<'new_writer' | 'edit', { label: string; className: string }> = {
  new_writer: { label: 'ขอเป็นนักเขียนใหม่', className: 'bg-primary/10 text-primary' },
  edit: { label: 'แก้ไขข้อมูล', className: 'bg-sky-50 text-sky-700' },
}

function ApplicationsTab() {
  const me = useAdminUser()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'pending' | 'approve' | 'rejected' | ''>('pending')
  const [type, setType] = useState<'new_writer' | 'edit' | ''>('')
  const [viewing, setViewing] = useState<WriterApplicationRow | null>(null)
  const [rejecting, setRejecting] = useState<WriterApplicationRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'writer-applications', status, type],
    queryFn: () =>
      api.get<{ data: WriterApplicationRow[] }>(
        `/admin/writer-applications?${[status && `status=${status}`, type && `application_type=${type}`].filter(Boolean).join('&')}`,
      ),
  })

  const rows = query.data?.data ?? []

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'writer-applications'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'writers-approved'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
  }

  async function handleApprove(row: WriterApplicationRow) {
    setError(null)
    setBusyId(row.id)
    try {
      await api.patch(`/admin/writer-applications/${row.id}/approve`)
      invalidate()
    } catch (err: any) {
      setError(err?.message ?? 'อนุมัติไม่สำเร็จ')
    } finally {
      setBusyId(null)
    }
  }

  async function handleReject() {
    if (!rejecting || !rejectReason.trim()) return
    setError(null)
    setBusyId(rejecting.id)
    try {
      await api.patch(`/admin/writer-applications/${rejecting.id}/reject`, { reason: rejectReason.trim() })
      invalidate()
      setRejecting(null)
      setRejectReason('')
    } catch (err: any) {
      setError(err?.message ?? 'ปฏิเสธไม่สำเร็จ')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-48">
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="">ทุกสถานะ</option>
            <option value="pending">รอตรวจสอบ</option>
            <option value="approve">อนุมัติแล้ว</option>
            <option value="rejected">ปฏิเสธแล้ว</option>
          </Select>
        </div>
        <div className="w-56">
          <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="">ทุกประเภทคำขอ</option>
            <option value="new_writer">ขอเป็นนักเขียนใหม่</option>
            <option value="edit">แก้ไขข้อมูล</option>
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
          <p className="text-sm text-muted-foreground">ไม่มีคำขอในสถานะนี้</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-border bg-card p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_LABEL[row.application_type].className}`}>
                    {TYPE_LABEL[row.application_type].label}
                  </span>
                  <span className="font-medium text-foreground">
                    {row.user_prefix}{row.first_name} {row.last_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    @{row.user.u_name} · {row.user.email}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{formatThaiDateTime(row.created_at)}</span>
              </div>
              <p className="mb-3 text-sm text-muted-foreground">สถานะ: {STATUS_LABEL[row.status] ?? row.status}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="h-8 text-xs" onClick={() => setViewing(row)}>
                  ดูรายละเอียด
                </Button>
                {row.status === 'pending' && (
                  <>
                    {row.user.uuid === me?.uuid ? (
                      <span className="self-center text-xs text-muted-foreground">
                        คำขอของคุณเอง — ต้องให้แอดมินคนอื่นอนุมัติ
                      </span>
                    ) : (
                      <Button className="h-8 text-xs" disabled={busyId === row.id} onClick={() => handleApprove(row)}>
                        อนุมัติ
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      className="h-8 text-xs"
                      disabled={busyId === row.id}
                      onClick={() => {
                        setError(null)
                        setRejecting(row)
                        setRejectReason('')
                      }}
                    >
                      ปฏิเสธ
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title="รายละเอียดคำขอเป็นนักเขียน">
        {viewing && (
          <div className="flex flex-col gap-1.5 text-sm">
            <DetailRow label="ประเภทคำขอ" value={TYPE_LABEL[viewing.application_type].label} />
            <DetailRow label="ชื่อ-นามสกุล" value={`${viewing.user_prefix}${viewing.first_name} ${viewing.last_name}`} />
            <DetailRow label="เลขบัตรประชาชน" value={viewing.national_id} />
            <DetailRow
              label="ที่อยู่ตามบัตร"
              value={[viewing.id_address, viewing.id_subdistrict, viewing.id_district, viewing.id_province, viewing.id_postal_code]
                .filter(Boolean)
                .join(' ')}
            />
            <DetailRow
              label="ที่อยู่ปัจจุบัน"
              value={[
                viewing.current_address,
                viewing.current_subdistrict,
                viewing.current_district,
                viewing.current_province,
                viewing.current_postal_code,
              ]
                .filter(Boolean)
                .join(' ')}
            />
            <DetailRow label="เบอร์โทรศัพท์" value={viewing.user_phone} />
            <DetailRow label="อีเมลบัญชี" value={viewing.user.email} />
            <DetailRow label="ธนาคาร" value={viewing.bank_name} />
            <DetailRow label="สาขา" value={viewing.bank_branch} />
            <DetailRow label="เลขบัญชี" value={viewing.bank_number} />
            {viewing.reject_reason && <DetailRow label="เหตุผลที่ปฏิเสธ (ครั้งก่อน)" value={viewing.reject_reason} />}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={`ปฏิเสธคำขอของ ${rejecting ? `${rejecting.user_prefix}${rejecting.first_name} ${rejecting.last_name}` : ''}`}
      >
        <label className="mb-1.5 block text-sm font-medium text-foreground">เหตุผล</label>
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={3}
          className="mb-4 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="ระบุเหตุผลที่ปฏิเสธ..."
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setRejecting(null)}>
            ยกเลิก
          </Button>
          <Button variant="destructive" disabled={!rejectReason.trim()} onClick={handleReject}>
            ยืนยันปฏิเสธ
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <span className="w-40 shrink-0 text-muted-foreground">{label}</span>
      <span className="text-foreground">{value || '—'}</span>
    </div>
  )
}
