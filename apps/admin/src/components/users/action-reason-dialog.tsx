'use client'

/**
 * components/users/action-reason-dialog.tsx — dialog กรอกเหตุผล ใช้ร่วมกัน 2 โหมด:
 * - mode="direct": level >= 9 ทำรายการเลยทันที (ระงับ/แบน/ลบ)
 * - mode="flag": level 8 ส่ง Flag เข้าคิวแทน (ทำตรงไม่ได้ — ดู admin.service.ts createUserFlag)
 */

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'

export function ActionReasonDialog({
  open,
  mode,
  actionLabel,
  targetName,
  onClose,
  onSubmit,
}: {
  open: boolean
  mode: 'direct' | 'flag'
  actionLabel: string
  targetName: string
  onClose: () => void
  onSubmit: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleClose() {
    if (submitting) return
    setReason('')
    onClose()
  }

  async function handleSubmit() {
    if (!reason.trim()) return
    setSubmitting(true)
    try {
      await onSubmit(reason.trim())
      setReason('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={mode === 'flag' ? `Flag: ${actionLabel} — ${targetName}` : `${actionLabel} — ${targetName}`}
    >
      {mode === 'flag' && (
        <p className="mb-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          Level 8 ทำรายการนี้เองไม่ได้ — ระบบจะส่ง Flag เข้าคิวแทน ถ้ามี level 8 คนอื่น flag เรื่อง
          เดียวกันกับคนนี้ครบตามเกณฑ์ในช่วงเวลาที่ตั้งไว้ ระบบจะดำเนินการให้อัตโนมัติ หรือ level 9
          ขึ้นไปตรวจแล้วอนุมัติเองได้ทันทีโดยไม่ต้องรอครบ
        </p>
      )}
      <label className="mb-1.5 block text-sm font-medium text-foreground">เหตุผล</label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        autoFocus
        className="mb-4 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        placeholder={mode === 'flag' ? 'ระบุเหตุผลที่ flag...' : 'ระบุเหตุผล...'}
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleClose} disabled={submitting}>
          ยกเลิก
        </Button>
        <Button variant="destructive" disabled={submitting || !reason.trim()} onClick={handleSubmit}>
          {mode === 'flag' ? 'ส่ง Flag' : 'ยืนยัน'}
        </Button>
      </div>
    </Modal>
  )
}
