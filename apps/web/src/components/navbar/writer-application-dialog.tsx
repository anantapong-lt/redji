'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { submitWriterBankAccount } from '@/controllers/writer.controller'
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
  writerApplicationEnabled: boolean
  banks: BankConfig[]
  isPending: boolean
  hasSocialLink: boolean
}

export function WriterApplicationDialog({ open, onOpenChange, writerApplicationEnabled, banks, isPending, hasSocialLink }: Props) {
  const { accessToken } = useAuth()
  const [form, setForm] = useState({
    account_holder_first_name: '',
    account_holder_last_name: '',
    bank_code: '',
    account_number: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  useEffect(() => {
    if (!open) {
      setForm({ account_holder_first_name: '', account_holder_last_name: '', bank_code: '', account_number: '' })
    }
  }, [open])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isPending || !hasSocialLink) return
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
        {!writerApplicationEnabled ? (
          <>
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-5 text-center">
              <p className="font-semibold text-foreground">ขณะนี้ระบบปิดรับสมัครเป็นนักเขียนชั่วคราว</p>
              <p className="mt-1 text-sm text-muted-foreground">กรุณาติดตามประกาศจากทางเว็บไซต์อีกครั้ง</p>
            </div>
            <DialogFooter className="-mx-5 -mb-5 rounded-b-2xl px-5 sm:-mx-6 sm:-mb-6 sm:px-6">
              <Button type="button" onClick={() => onOpenChange(false)}>ปิด</Button>
            </DialogFooter>
          </>
        ) : isPending ? (
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-5 text-center">
            <p className="font-semibold text-foreground">ใบสมัครของคุณอยู่ระหว่างตรวจสอบข้อมูล</p>
            <p className="mt-1 text-sm text-muted-foreground">กรุณารอผลการพิจารณา 1–3 วัน ระบบจะแจ้งให้ทราบเมื่อมีผล</p>
          </div>
        ) : !hasSocialLink ? (
          <>
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-5 text-center">
              <p className="font-semibold text-foreground">กรุณาเพิ่ม Social ในหน้าโปรไฟล์อย่างน้อย 1 รายการก่อนสมัคร</p>
              <p className="mt-1 text-sm text-muted-foreground">รองรับ Facebook, Instagram, X, TikTok, YouTube หรือเว็บไซต์</p>
            </div>
            <DialogFooter className="-mx-5 -mb-5 rounded-b-2xl px-5 sm:-mx-6 sm:-mb-6 sm:px-6">
              <Button asChild>
                <Link href="/profile" onClick={() => onOpenChange(false)}>ไปตั้งค่า Social ในโปรไฟล์</Link>
              </Button>
            </DialogFooter>
          </>
        ) : <form onSubmit={handleSubmit} className="space-y-4">
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
            >
              <SelectTrigger id="writer-bank-code" className="w-full">
                <SelectValue placeholder="เลือกธนาคาร" />
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
        </form>}
      </DialogContent>
    </Dialog>
  )
}
