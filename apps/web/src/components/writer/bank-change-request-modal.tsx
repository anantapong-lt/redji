'use client'

/**
 * components/writer/bank-change-request-modal.tsx — "ส่งคำร้องขอเปลี่ยนข้อมูลธนาคาร" (2026-08-06, ใหม่)
 *
 * อิงภาพอ้างอิงที่ user ส่งมา — เลือกธนาคาร + ชื่อบัญชี + เลขบัญชี + เหตุผล + แนบหลักฐาน (สมุดบัญชี+
 * บัตรประชาชนในไฟล์เดียว) + checkbox ยืนยัน แล้วส่งรอแอดมินอนุมัติ (ยังไม่มีผลจริงจนกว่าจะอนุมัติ —
 * ดู approveBankChangeRequest() ฝั่ง backend) จำกัด 2 ครั้ง/30 วัน (โควตาแสดงจาก GET /writer/bank-info)
 *
 * ยังไม่มีโลโก้ธนาคารจริง — user แจ้งว่าจะเอามาใส่เองทีหลัง ตอนนี้โชว์แค่ชื่อธนาคารเป็นตัวหนังสือ
 */

import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import Image from 'next/image'
import { FileImage } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { THAI_BANKS } from '@/lib/thai-banks'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const REASON_MAX_LENGTH = 1000

interface ApiBankInfo {
  bank_code: string | null
  account_name: string | null
  account_number: string | null
  changes_used_last_30_days: number
  changes_limit: number
  has_pending_request: boolean
}

export function BankChangeRequestModal({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}) {
  const [bankCode, setBankCode] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [reason, setReason] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const bankInfoQuery = useQuery({
    queryKey: ['writer', 'bank-info'],
    queryFn: () => api.get<{ data: ApiBankInfo }>('/writer/bank-info').then((r) => r.data),
    enabled: open,
  })

  useEffect(() => {
    if (open) {
      setBankCode('')
      setAccountName('')
      setAccountNumber('')
      setReason('')
      setFile(null)
      setPreview(null)
      setConfirmed(false)
      setError(null)
    }
  }, [open])

  const onDrop = useCallback((accepted: File[]) => {
    const f = accepted[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'] },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
  })

  const bankInfo = bankInfoQuery.data
  const changesUsed = bankInfo?.changes_used_last_30_days ?? 0
  const changesLimit = bankInfo?.changes_limit ?? 2
  const quotaExceeded = bankInfo ? changesUsed >= changesLimit : false
  const hasPending = bankInfo?.has_pending_request ?? false
  const canSubmit = !bankInfoQuery.isLoading && !hasPending && !quotaExceeded

  function validate(): string | null {
    if (!bankCode) return 'กรุณาเลือกธนาคาร'
    if (!accountName.trim()) return 'กรุณากรอกชื่อบัญชี'
    if (!accountNumber.trim()) return 'กรุณากรอกเลขบัญชี'
    if (!file) return 'กรุณาแนบภาพสมุดบัญชีและบัตรประชาชน'
    if (!confirmed) return 'กรุณายืนยันว่าข้อมูลถูกต้อง'
    return null
  }

  async function handleSubmit() {
    const err = validate()
    if (err) {
      setError(err)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('bank_code', bankCode)
      formData.append('account_name', accountName.trim())
      formData.append('account_number', accountNumber.trim())
      if (reason.trim()) formData.append('reason', reason.trim())
      formData.append('document', file!)
      await api.post('/writer/bank-change-requests', formData)
      toast.success('ส่งคำขอเปลี่ยนบัญชีธนาคารสำเร็จ รอการตรวจสอบ')
      onOpenChange(false)
      onSuccess()
    } catch (err: any) {
      setError(err?.message ?? 'ส่งคำขอไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ส่งคำร้องขอเปลี่ยนข้อมูลธนาคาร</DialogTitle>
        </DialogHeader>

        {bankInfoQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : hasPending ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            มีคำขอเปลี่ยนบัญชีธนาคารที่รอดำเนินการอยู่แล้ว กรุณารอผลการตรวจสอบก่อนส่งคำขอใหม่
          </p>
        ) : quotaExceeded ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            ขอเปลี่ยนบัญชีธนาคารครบโควตา {changesLimit} ครั้ง ภายใน 30 วันแล้ว กรุณาลองใหม่ภายหลัง
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              เปลี่ยนบัญชีธนาคารได้ {changesUsed}/{changesLimit} ครั้งใน 30 วันที่ผ่านมา — คำขอที่ส่งจะรอแอดมิน
              ตรวจสอบก่อนมีผลจริง
            </p>

            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">ธนาคาร</label>
              <Select value={bankCode} onValueChange={setBankCode}>
                <SelectTrigger className="!h-9 w-full border">
                  <SelectValue placeholder="เลือกธนาคาร" />
                </SelectTrigger>
                <SelectContent>
                  {THAI_BANKS.map((b) => (
                    <SelectItem key={b.code} value={b.code}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">ชื่อบัญชี (ตามสมุดบัญชี)</label>
              <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="ชื่อ-นามสกุล" />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">เลขบัญชี</label>
              <Input
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9-]/g, ''))}
                placeholder="เลขที่บัญชีธนาคาร"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">เหตุผล/รายละเอียดเพิ่มเติม (ถ้ามี)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX_LENGTH))}
                rows={3}
                className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="เช่น เปลี่ยนเพราะบัญชีเดิมปิดแล้ว"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {reason.length}/{REASON_MAX_LENGTH}
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">แนบภาพสมุดบัญชีและบัตรประชาชน</label>
              <div
                {...getRootProps()}
                className={cn(
                  'flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/40 p-4 text-center transition-colors hover:border-primary/40',
                  isDragActive && 'border-primary bg-primary/5',
                )}
              >
                <input {...getInputProps()} />
                {preview ? (
                  <div className="relative h-32 w-full overflow-hidden rounded-lg">
                    <Image src={preview} alt="หลักฐานบัญชีธนาคาร" fill unoptimized className="object-contain" />
                  </div>
                ) : (
                  <>
                    <FileImage className="size-6 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์
                      <br />
                      JPG, PNG, WebP ขนาดไม่เกิน 5MB
                    </p>
                  </>
                )}
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
              />
              ข้าพเจ้ายืนยันว่าข้อมูลบัญชีธนาคารและหลักฐานที่แนบมาถูกต้องตรงกับความเป็นจริง
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            ยกเลิก
          </Button>
          {canSubmit && (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'กำลังส่ง...' : 'ส่งคำขอ'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
