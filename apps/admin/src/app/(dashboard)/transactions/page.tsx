'use client'

/**
 * app/(dashboard)/transactions/page.tsx — "จัดการธุรกรรม" (2026-08-04, ใหม่)
 *
 * อนุมัติ/ปฏิเสธคำขอถอนเงินของนักเขียนโดยเฉพาะ — ผูกกับ listWithdrawals/approveWithdrawal/
 * rejectWithdrawal ใน admin.service.ts ที่มีอยู่แล้วสมบูรณ์ (approve จะหัก users.sales ให้อัตโนมัติ
 * ฝั่ง backend) แต่ก่อนหน้านี้ไม่เคยมีหน้า UI เรียกใช้เลย
 *
 * เข้าถึงได้เฉพาะ level >= 9 (user ยืนยัน — level 10 เข้าได้ด้วยตามรูปแบบเดิมของทั้งระบบ) ล็อกทั้ง
 * ฝั่ง nav (ซ่อนไปเลยถ้า level ไม่พอ — ดู layout.tsx) และฝั่ง backend (admin.routes.ts) เอง เช็คซ้ำ
 * ในหน้านี้เป็น fallback เผื่อเข้าทาง URL ตรงๆ
 *
 * 2026-08-06 (migration 033): ระบบนี้ไม่มีการโอนเงินอัตโนมัติเลย (ไม่ได้ต่อ banking API) แอดมิน
 * ยังต้องโอนเงินจริงเองผ่านแอปธนาคารนอกระบบ — user ขอให้ตอนกด "อนุมัติ" ต้องแนบ "หลักฐานการโอน"
 * (สลิป) เป็นหลักฐานด้วยเสมอ เลยเปลี่ยนจากปุ่มกดครั้งเดียว+confirm() เป็น modal บังคับแนบไฟล์ก่อน
 * — "ผู้โอน" ไม่มี field แยกต่างหาก ใช้ชื่อแอดมินที่กดอนุมัติ (approved_by) ตัวเดียวกันเลย
 *
 * 2026-08-18: เพิ่มแท็บ "โค้ดส่วนลด/เติมเหรียญ" (RedeemCodesTab) เข้ามาในหน้านี้แทนที่จะเพิ่ม nav
 * item ระดับบนสุดใหม่ — layout.tsx ระบุไว้ชัดว่า "เลขหลักในสเปค 9 ข้อ = แท็บแยกกันเด็ดขาด" (ห้าม
 * เพิ่มแท็บบนสุดใหม่นอกสเปคเดิม) เรื่องโค้ดเป็นเรื่องการเงิน/เศรษฐกิจเหมือนคำขอถอนเงินอยู่แล้ว
 * เลยเข้ากันได้ดีที่สุดในแท็บนี้ ใช้ pattern แท็บย่อยแบบเดียวกับหน้า site/page.tsx
 */

import { useState, type ChangeEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { api } from '@/lib/api'
import { formatThaiDateTime } from '@/lib/utils'
import { getBankName } from '@/lib/thai-banks'
import { useAdminUser } from '@/store/auth.store'
import { RedeemCodesTab } from '@/components/transactions/redeem-codes-tab'
import { BankChangeRequestsTab } from '@/components/transactions/bank-change-requests-tab'
import type { WithdrawalRow, Pagination } from '@/types'

const MAX_PROOF_SIZE = 5 * 1024 * 1024

const STATUS_TABS = [
  { key: 'pending', label: 'รอตรวจสอบ' },
  { key: 'approved', label: 'อนุมัติแล้ว' },
  { key: 'rejected', label: 'ปฏิเสธแล้ว' },
  { key: '', label: 'ทั้งหมด' },
] as const

const STATUS_LABEL: Record<string, string> = {
  pending: 'รอตรวจสอบ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ปฏิเสธแล้ว',
}

const TABS = [
  { key: 'withdrawals', label: 'คำขอถอนเงิน' },
  { key: 'bank_change', label: 'คำขอเปลี่ยนบัญชีธนาคาร' },
  { key: 'redeem_codes', label: 'โค้ดส่วนลด/เติมเหรียญ' },
] as const
type TabKey = (typeof TABS)[number]['key']

export default function TransactionsPage() {
  const me = useAdminUser()
  const myLevel = me?.level ?? 0
  const [tab, setTab] = useState<TabKey>('withdrawals')

  if (myLevel < 9) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-foreground">จัดการธุรกรรม</h1>
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          ต้องเป็นแอดมินรองขึ้นไป (level ≥ 9) ถึงจะเข้าดูแท็บนี้ได้
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">จัดการธุรกรรม</h1>

      <div className="mb-5 flex gap-2.5">
        {TABS.map((t) => (
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

      {tab === 'withdrawals' ? <WithdrawalsTable /> : tab === 'bank_change' ? <BankChangeRequestsTab /> : <RedeemCodesTab />}
    </div>
  )
}

function WithdrawalsTable() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]['key']>('pending')
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<WithdrawalRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [approving, setApproving] = useState<WithdrawalRow | null>(null)
  const [approveTransferredByName, setApproveTransferredByName] = useState('')
  const [approveNote, setApproveNote] = useState('')
  const [approveFile, setApproveFile] = useState<File | null>(null)
  const [approveFilePreview, setApproveFilePreview] = useState<string | null>(null)
  const [approveFileError, setApproveFileError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'withdrawals', status, page],
    queryFn: () =>
      api.get<{ data: WithdrawalRow[]; pagination: Pagination }>(
        `/admin/withdrawals?page=${page}&limit=20${status ? `&status=${status}` : ''}`,
      ),
  })

  const rows = query.data?.data ?? []
  const pagination = query.data?.pagination

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals'] })
  }

  function closeApprove() {
    setApproving(null)
    setApproveTransferredByName('')
    setApproveNote('')
    setApproveFile(null)
    setApproveFilePreview(null)
    setApproveFileError(null)
  }

  function handleApproveFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setApproveFileError(null)
    if (!file) {
      setApproveFile(null)
      setApproveFilePreview(null)
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setApproveFileError('รองรับเฉพาะ JPG, PNG, WebP เท่านั้น')
      return
    }
    if (file.size > MAX_PROOF_SIZE) {
      setApproveFileError('ไฟล์ต้องไม่เกิน 5MB')
      return
    }
    setApproveFile(file)
    setApproveFilePreview(URL.createObjectURL(file))
  }

  async function handleApprove() {
    if (!approving || !approveFile || !approveTransferredByName.trim()) return
    setError(null)
    setBusyId(approving.id)
    try {
      const formData = new FormData()
      formData.append('proof', approveFile)
      formData.append('transferred_by_name', approveTransferredByName.trim())
      if (approveNote.trim()) formData.append('note', approveNote.trim())
      await api.patch(`/admin/withdrawals/${approving.id}/approve`, formData)
      invalidate()
      closeApprove()
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
      await api.patch(`/admin/withdrawals/${rejecting.id}/reject`, { note: rejectReason.trim() })
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
      <div className="mb-5 flex gap-2.5">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setStatus(t.key)
              setPage(1)
            }}
            className={
              status === t.key
                ? 'cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground'
                : 'cursor-pointer rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">นักเขียน</th>
              <th className="px-4 py-3 font-medium">บัญชีธนาคาร</th>
              <th className="px-4 py-3 font-medium">จำนวนที่ขอถอน</th>
              <th className="px-4 py-3 font-medium">ค่าธรรมเนียม</th>
              <th className="px-4 py-3 font-medium">ยอดที่ได้รับจริง</th>
              <th className="px-4 py-3 font-medium">วันที่ขอ</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
              <th className="px-4 py-3 font-medium">ผู้โอน</th>
              <th className="px-4 py-3 font-medium">หลักฐานการโอน</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  กำลังโหลด...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  ไม่มีคำขอถอนเงินในสถานะนี้
                </td>
              </tr>
            ) : (
              rows.map((w) => (
                <tr key={w.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{w.user.display_name}</div>
                    <div className="text-xs text-muted-foreground">{w.user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-foreground">{getBankName(w.bank_code)}</div>
                    <div className="text-xs text-muted-foreground">{w.account_name} · {w.account_number}</div>
                  </td>
                  <td className="px-4 py-3">{w.amount}</td>
                  <td className="px-4 py-3 text-muted-foreground">{Number(w.fee_amount) > 0 ? `${w.fee_amount} บาท` : '-'}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{w.net_amount}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatThaiDateTime(w.created_at)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        w.status === 'pending'
                          ? 'inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                          : w.status === 'approved'
                            ? 'inline-flex rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success'
                            : 'inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive'
                      }
                    >
                      {STATUS_LABEL[w.status]}
                    </span>
                    {w.reason && <div className="mt-1 max-w-48 text-xs text-muted-foreground">{w.reason}</div>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {w.status === 'approved' ? (w.transferred_by_name ?? '-') : w.status === 'pending' ? 'รอตรวจสอบ' : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {w.status === 'approved' && w.transfer_proof_url ? (
                      <a href={w.transfer_proof_url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={w.transfer_proof_url}
                          alt="หลักฐานการโอน"
                          className="h-10 w-10 rounded-lg border border-border object-cover hover:opacity-80"
                        />
                      </a>
                    ) : w.status === 'pending' ? (
                      <span className="text-xs text-muted-foreground">รอตรวจสอบ</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {w.status === 'pending' && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="h-7 text-xs"
                          disabled={busyId === w.id}
                          onClick={() => {
                            setError(null)
                            setApproving(w)
                          }}
                        >
                          อนุมัติ
                        </Button>
                        <Button
                          variant="destructive"
                          className="h-7 text-xs"
                          disabled={busyId === w.id}
                          onClick={() => {
                            setError(null)
                            setRejecting(w)
                            setRejectReason('')
                          }}
                        >
                          ปฏิเสธ
                        </Button>
                      </div>
                    )}
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

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={`ปฏิเสธคำขอถอนเงินของ ${rejecting?.user.display_name ?? ''}`}
      >
        <label className="mb-1.5 block text-sm font-medium text-foreground">เหตุผล (นักเขียนจะเห็นข้อความนี้)</label>
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

      <Modal
        open={Boolean(approving)}
        onClose={closeApprove}
        title={`อนุมัติคำขอถอนเงินของ ${approving?.user.display_name ?? ''}`}
      >
        <p className="mb-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          ระบบนี้ไม่ได้โอนเงินอัตโนมัติ — กรุณาโอนเงิน {approving?.net_amount} บาท เข้าบัญชี{' '}
          {approving && getBankName(approving.bank_code)} {approving?.account_name} ({approving?.account_number}) เอง
          ผ่านแอปธนาคารก่อน แล้วแนบสลิปยืนยันด้านล่างนี้
        </p>

        {approveFileError && (
          <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {approveFileError}
          </p>
        )}

        <label className="mb-1.5 block text-sm font-medium text-foreground">ชื่อผู้อนุมัติ/ผู้โอน *</label>
        <input
          type="text"
          value={approveTransferredByName}
          onChange={(e) => setApproveTransferredByName(e.target.value)}
          maxLength={100}
          placeholder="ชื่อ-นามสกุลผู้ทำรายการโอนจริง"
          className="mb-3 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />

        <label className="mb-1.5 block text-sm font-medium text-foreground">หลักฐานการโอน (สลิป) *</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleApproveFileChange}
          className="mb-3 block w-full text-sm text-foreground file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground"
        />
        {approveFilePreview && (
          // eslint-disable-next-line @next/next/no-img-element -- preview จาก object URL ของไฟล์ที่เพิ่งเลือก ยังไม่มี URL จริงให้ next/image ใช้
          <img src={approveFilePreview} alt="ตัวอย่างสลิป" className="mb-3 h-32 rounded-lg border border-border object-contain" />
        )}

        <label className="mb-1.5 block text-sm font-medium text-foreground">หมายเหตุ (ไม่บังคับ)</label>
        <textarea
          value={approveNote}
          onChange={(e) => setApproveNote(e.target.value)}
          rows={2}
          maxLength={500}
          className="mb-4 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="ระบุหมายเหตุ (ถ้ามี)..."
        />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={closeApprove} disabled={busyId === approving?.id}>
            ยกเลิก
          </Button>
          <Button
            disabled={!approveFile || !approveTransferredByName.trim() || busyId === approving?.id}
            onClick={handleApprove}
          >
            {busyId === approving?.id ? 'กำลังอนุมัติ...' : 'ยืนยันอนุมัติ'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
