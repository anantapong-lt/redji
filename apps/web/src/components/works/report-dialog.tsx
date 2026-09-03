'use client'

/**
 * components/works/report-dialog.tsx — dialog รายงานเนื้อหา (2026-07-30, +หมวดหมู่ 2026-08-06)
 *
 * ใช้ร่วมกัน 3 จุด: รายงานคอมเม้นในหน้ารายละเอียดนิยาย, รายงานคอมเม้นในหน้าอ่านตอน,
 * รายงานทั้งเรื่อง (novel-hero-section.tsx) — ยิง POST /social/reports จริง (content_reports,
 * migration 025) แทนปุ่มเดิมที่เป็น devToast.info() mock ล้วนๆ
 *
 * migration 032: เพิ่ม dropdown หมวดหมู่ (บังคับเลือก) — user อ้างอิงหน้า ReadToon Creator มา
 * หมวด "รายงานความผิดพลาด (สะกดผิด, เขียนผิด, แท็กผิด)" จะเด้งเข้าคิว "รายงานที่ได้รับ" ของ
 * นักเขียนเจ้าของผลงานแทนคิวแอดมิน (ที่เหลือทั้งหมดเข้าคิวแอดมินเหมือนเดิม — ดู
 * lib/report-categories.ts) ใช้ dropdown เดียวกันทั้งรายงาน work และรายงาน comment
 *
 * 2026-08-18: เพิ่ม targetType='user' (ปุ่ม "รายงาน" ในหน้าโปรไฟล์ profile-header.tsx เดิม mock) —
 * ซ่อนหมวด "รายงานความผิดพลาด" ออกจาก dropdown เฉพาะตอนรายงานคน เพราะหมวดนั้นความหมายผูกกับเนื้อหา
 * ในผลงาน (สะกดผิด/แท็กผิด) ไม่มีความหมายกับการรายงานตัวบุคคลเลย
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { REPORT_CATEGORIES, type ReportCategory } from '@/lib/report-categories'

const REASON_MAX = 500

export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetRef,
  title,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetType: 'comment' | 'work' | 'user'
  targetRef: string
  title: string
}) {
  const [category, setCategory] = useState<ReportCategory | ''>('')
  const categoryOptions = targetType === 'user' ? REPORT_CATEGORIES.filter((c) => c.code !== 'content_error') : REPORT_CATEGORIES
  const [reason, setReason] = useState('')
  const [sending, setSending] = useState(false)

  function handleOpenChange(next: boolean) {
    if (sending) return
    onOpenChange(next)
    if (!next) {
      setReason('')
      setCategory('')
    }
  }

  async function handleSubmit() {
    if (!category || !reason.trim()) return
    setSending(true)
    try {
      await api.post('/social/reports', {
        target_type: targetType,
        target_ref: targetRef,
        category,
        reason: reason.trim(),
      })
      toast.success('ส่งรายงานแล้ว ทีมงานจะตรวจสอบโดยเร็วที่สุด')
      handleOpenChange(false)
    } catch (err: any) {
      toast.error(err?.message ?? 'ส่งรายงานไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">หมวดหมู่</label>
            <Select value={category} onValueChange={(v) => setCategory(v as ReportCategory)}>
              <SelectTrigger className="!h-9 w-full border">
                <SelectValue placeholder="เลือกหมวดหมู่" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">รายละเอียด</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, REASON_MAX))}
              maxLength={REASON_MAX}
              rows={4}
              placeholder="อธิบายเพิ่มเติมเกี่ยวกับสิ่งที่พบ..."
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {reason.length}/{REASON_MAX}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={sending} onClick={() => handleOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button variant="destructive" disabled={sending || !category || !reason.trim()} onClick={handleSubmit}>
            ส่งรายงาน
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
