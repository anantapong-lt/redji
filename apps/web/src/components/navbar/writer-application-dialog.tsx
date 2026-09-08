'use client'

import { FormEvent, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { getBankConfigs, submitWriterBankAccount } from '@/controllers/writer.controller'
import type { BankConfig } from '@/interface/writer-bank-account.interface'
import { SITE_CONFIG } from '@/site.config'
import { useAuth } from '@/components/auth/auth-provider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WriterApplicationDialog({ open, onOpenChange }: Props) {
  const { accessToken } = useAuth()
  const [form, setForm] = useState({
    account_holder_first_name: '',
    account_holder_last_name: '',
    bank_code: '',
    account_number: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [banks, setBanks] = useState<BankConfig[]>([])
  const [isLoadingBanks, setIsLoadingBanks] = useState(false)

  useEffect(() => {
    if (!open || !accessToken) return
    setIsLoadingBanks(true)
    void getBankConfigs(accessToken)
      .then((result) => setBanks(result.banks))
      .catch(() => toast.error('ไม่สามารถโหลดรายการธนาคารได้'))
      .finally(() => setIsLoadingBanks(false))
  }, [accessToken, open])

  useEffect(() => {
    if (!open)
      setForm({ account_holder_first_name: '', account_holder_last_name: '', bank_code: '', account_number: '' })
  }, [open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!accessToken) {
      toast.error('กรุณาเข้าสู่ระบบอีกครั้ง')
      return
    }
    setIsSubmitting(true)
    try {
      await submitWriterBankAccount(form, accessToken)
      toast.success('ส่งใบสมัครนักเขียนเรียบร้อยแล้ว')
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ไม่สามารถส่งใบสมัครได้')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5 rounded-2xl p-5 sm:max-w-md sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">สมัครเป็นนักเขียน</DialogTitle>
          <DialogDescription>
            กรอกข้อมูลบัญชีธนาคารสำหรับรับรายได้จากผลงาน ข้อมูลนี้ใช้เพื่อการโอนเงินจากระบบเท่านั้น ระบบจะแจ้งผลภายใน
            1–3 วัน
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="writer-first-name">ชื่อ</Label>
              <Input
                id="writer-first-name"
                required
                value={form.account_holder_first_name}
                onChange={(e) => setForm({ ...form, account_holder_first_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="writer-last-name">นามสกุล</Label>
              <Input
                id="writer-last-name"
                required
                value={form.account_holder_last_name}
                onChange={(e) => setForm({ ...form, account_holder_last_name: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="writer-bank-code">ธนาคาร</Label>
            <Select
              required
              value={form.bank_code}
              onValueChange={(value) => setForm({ ...form, bank_code: value })}
              disabled={isLoadingBanks}
            >
              <SelectTrigger id="writer-bank-code" className="w-full">
                <SelectValue placeholder={isLoadingBanks ? 'กำลังโหลดรายการธนาคาร...' : 'เลือกธนาคาร'} />
              </SelectTrigger>
              <SelectContent
                position="popper"
                side="bottom"
                sideOffset={4}
                avoidCollisions={false}
                className="max-h-72 w-full"
              >
                {banks.map((bank) => (
                  <SelectItem key={bank.code} value={bank.code}>
                    <span className="flex items-center gap-2">
                      <img src={`${SITE_CONFIG.apiUrl}/writer/${bank.logo}`} alt="" className="size-5 object-contain" />
                      {bank.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="writer-account-number">เลขที่บัญชี</Label>
            <Input
              id="writer-account-number"
              required
              inputMode="numeric"
              pattern="[0-9]{8,20}"
              value={form.account_number}
              onChange={(e) => setForm({ ...form, account_number: e.target.value.replace(/\D/g, '') })}
            />
          </div>
          <DialogFooter className="-mx-5 -mb-5 rounded-b-2xl px-5 sm:-mx-6 sm:-mb-6 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'กำลังส่ง...' : 'ส่งใบสมัคร'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
