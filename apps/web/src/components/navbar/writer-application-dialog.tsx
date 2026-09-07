'use client'

import { FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { submitWriterBankAccount } from '@/controllers/writer.controller'
import { useAuth } from '@/components/auth/auth-provider'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface Props { open: boolean; onOpenChange: (open: boolean) => void }

export function WriterApplicationDialog({ open, onOpenChange }: Props) {
  const { accessToken } = useAuth()
  const [form, setForm] = useState({ account_holder_first_name: '', account_holder_last_name: '', bank_code: '', account_number: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) setForm({ account_holder_first_name: '', account_holder_last_name: '', bank_code: '', account_number: '' })
  }, [open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!accessToken) { toast.error('กรุณาเข้าสู่ระบบอีกครั้ง'); return }
    setIsSubmitting(true)
    try {
      await submitWriterBankAccount(form, accessToken)
      toast.success('ส่งใบสมัครนักเขียนเรียบร้อยแล้ว')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ไม่สามารถส่งใบสมัครได้')
    } finally { setIsSubmitting(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 rounded-2xl p-5 sm:max-w-md sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">สมัครเป็นนักเขียน</DialogTitle>
          <DialogDescription>กรอกข้อมูลบัญชีธนาคารสำหรับรับรายได้จากผลงาน</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="writer-first-name">ชื่อเจ้าของบัญชี</Label><Input id="writer-first-name" required value={form.account_holder_first_name} onChange={(e) => setForm({ ...form, account_holder_first_name: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="writer-last-name">นามสกุลเจ้าของบัญชี</Label><Input id="writer-last-name" required value={form.account_holder_last_name} onChange={(e) => setForm({ ...form, account_holder_last_name: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="writer-bank-code">ธนาคาร</Label><Input id="writer-bank-code" required placeholder="เช่น KBank, SCB" value={form.bank_code} onChange={(e) => setForm({ ...form, bank_code: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="writer-account-number">เลขที่บัญชี</Label><Input id="writer-account-number" required inputMode="numeric" pattern="[0-9]{8,20}" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value.replace(/\D/g, '') })} /></div>
          <DialogFooter className="-mx-5 -mb-5 rounded-b-2xl px-5 sm:-mx-6 sm:-mb-6 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'กำลังส่ง...' : 'ส่งใบสมัคร'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
