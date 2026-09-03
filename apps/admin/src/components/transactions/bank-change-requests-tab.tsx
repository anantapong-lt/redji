'use client'

/**
 * components/transactions/bank-change-requests-tab.tsx — "คำขอเปลี่ยนบัญชีธนาคาร" (2026-08-18, ใหม่)
 *
 * Backend (bank_change_requests, migration 031 — listBankChangeRequests/approveBankChangeRequest/
 * rejectBankChangeRequest ใน admin.service.ts) พร้อมสมบูรณ์มาตั้งแต่ 2026-08-06 แต่ไม่เคยมี UI
 * ให้เรียกใช้เลย — ใช้ pattern เดียวกับตาราง "คำขอถอนเงิน" ในหน้านี้ (สถานะ tab + ตาราง + modal
 * อนุมัติ/ปฏิเสธ) ต่างกันตรงที่อนุมัติไม่ต้องแนบไฟล์หลักฐานการโอนเหมือนถอนเงิน (แค่ note ไม่บังคับ)
 * เพราะ "หลักฐาน" ของฝั่งนี้คือภาพที่นักเขียนแนบมาเอง (document_url) ที่แอดมินต้องเปิดดูก่อนอนุมัติ
 * — ไม่ใช่สิ่งที่แอดมินสร้างขึ้นตอนอนุมัติแบบถอนเงิน
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { api } from '@/lib/api'
import { formatThaiDateTime } from '@/lib/utils'
import { getBankName } from '@/lib/thai-banks'
import type { BankChangeRequestRow, Pagination } from '@/types'

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

export function BankChangeRequestsTab() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]['key']>('pending')
  const [page, setPage] = useState(1)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<BankChangeRequestRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [approving, setApproving] = useState<BankChangeRequestRow | null>(null)
  const [approveNote, setApproveNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'bank-change-requests', status, page],
    queryFn: () =>
      api.get<{ data: BankChangeRequestRow[]; pagination: Pagination }>(
        `/admin/bank-change-requests?page=${page}&limit=20${status ? `&status=${status}` : ''}`,
      ),
  })

  const rows = query.data?.data ?? []
  const pagination = query.data?.pagination

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['admin', 'bank-change-requests'] })
  }

  async function handleApprove() {
    if (!approving) return
    setError(null)
    setBusyId(approving.id)
    try {
      await api.patch(`/admin/bank-change-requests/${approving.id}/approve`, {
        note: approveNote.trim() || undefined,
      })
      invalidate()
      setApproving(null)
      setApproveNote('')
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
      await api.patch(`/admin/bank-change-requests/${rejecting.id}/reject`, { note: rejectReason.trim() })
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
              <th className="px-4 py-3 font-medium">บัญชีธนาคารที่ขอเปลี่ยนเป็น</th>
              <th className="px-4 py-3 font-medium">หลักฐาน</th>
              <th className="px-4 py-3 font-medium">เหตุผลที่ขอ</th>
              <th className="px-4 py-3 font-medium">วันที่ขอ</th>
              <th className="px-4 py-3 font-medium">สถานะ</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  กำลังโหลด...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  ไม่มีคำขอในสถานะนี้
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{r.user.display_name}</div>
                    <div className="text-xs text-muted-foreground">{r.user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-foreground">{getBankName(r.bank_code)}</div>
                    <div className="text-xs text-muted-foreground">{r.account_name} · {r.account_number}</div>
                  </td>
                  <td className="px-4 py-3">
                    <a href={r.document_url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={r.document_url}
                        alt="หลักฐาน (สมุดบัญชี+บัตรประชาชน)"
                        className="h-10 w-10 rounded-lg border border-border object-cover hover:opacity-80"
                      />
                    </a>
                  </td>
                  <td className="px-4 py-3 max-w-48 text-muted-foreground">{r.reason ?? '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatThaiDateTime(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        r.status === 'pending'
                          ? 'inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground'
                          : r.status === 'approved'
                            ? 'inline-flex rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success'
                            : 'inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive'
                      }
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                    {r.review_note && <div className="mt-1 max-w-48 text-xs text-muted-foreground">{r.review_note}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === 'pending' && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="h-7 text-xs"
                          disabled={busyId === r.id}
                          onClick={() => {
                            setError(null)
                            setApproving(r)
                            setApproveNote('')
                          }}
                        >
                          อนุมัติ
                        </Button>
                        <Button
                          variant="destructive"
                          className="h-7 text-xs"
                          disabled={busyId === r.id}
                          onClick={() => {
                            setError(null)
                            setRejecting(r)
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
        open={Boolean(approving)}
        onClose={() => setApproving(null)}
        title={`อนุมัติคำขอเปลี่ยนบัญชีธนาคารของ ${approving?.user.display_name ?? ''}`}
      >
        {approving && (
          <div className="mb-4 flex flex-col gap-3">
            <a href={approving.document_url} target="_blank" rel="noopener noreferrer">
              <img
                src={approving.document_url}
                alt="หลักฐาน (สมุดบัญชี+บัตรประชาชน)"
                className="max-h-72 w-full rounded-lg border border-border object-contain"
              />
            </a>
            <p className="text-xs text-muted-foreground">คลิกรูปเพื่อดูภาพเต็ม — ตรวจสอบชื่อ-เลขบัญชีในภาพให้ตรงกับที่กรอกก่อนอนุมัติเสมอ</p>
            <div className="rounded-lg bg-muted/40 p-3 text-sm">
              <div className="text-foreground">{getBankName(approving.bank_code)}</div>
              <div className="text-muted-foreground">{approving.account_name} · {approving.account_number}</div>
            </div>
          </div>
        )}
        <label className="mb-1.5 block text-sm font-medium text-foreground">โน้ต (ไม่บังคับ)</label>
        <textarea
          value={approveNote}
          onChange={(e) => setApproveNote(e.target.value)}
          rows={2}
          className="mb-4 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="โน้ตภายใน (นักเขียนไม่เห็น)..."
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setApproving(null)}>
            ยกเลิก
          </Button>
          <Button disabled={busyId === approving?.id} onClick={handleApprove}>
            ยืนยันอนุมัติ
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={`ปฏิเสธคำขอเปลี่ยนบัญชีธนาคารของ ${rejecting?.user.display_name ?? ''}`}
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
    </div>
  )
}
