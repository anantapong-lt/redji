'use client'

/**
 * components/site/faq-dialog.tsx — เพิ่ม/แก้ไขคำถามที่พบบ่อย (2026-08-18, ใหม่)
 * โหมดเดียวครอบทั้งสร้างและแก้ไข (faq: null = สร้างใหม่) เหมือน category-dialog.tsx/web-contact-dialog.tsx
 */

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import type { FaqAdminRow } from '@/types'

export function FaqDialog({
  faq,
  open,
  onClose,
  onSaved,
}: {
  faq: FaqAdminRow | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = faq !== null

  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [status, setStatus] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (faq) {
      setQuestion(faq.question)
      setAnswer(faq.answer)
      setSortOrder(String(faq.sort_order))
      setStatus(faq.status)
    } else {
      setQuestion('')
      setAnswer('')
      setSortOrder('0')
      setStatus(true)
    }
    setError(null)
  }, [open, faq])

  async function handleSave() {
    setError(null)
    if (!question.trim()) {
      setError('กรุณาใส่คำถาม')
      return
    }
    if (!answer.trim()) {
      setError('กรุณาใส่คำตอบ')
      return
    }

    const body = {
      question: question.trim(),
      answer: answer.trim(),
      sort_order: Number(sortOrder) || 0,
    }

    setSaving(true)
    try {
      if (isEdit) {
        await api.patch(`/admin/faqs/${faq.id}`, { ...body, status })
      } else {
        await api.post('/admin/faqs', body)
      }
      onClose()
      onSaved()
    } catch (err: any) {
      setError(err?.message ?? 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title={isEdit ? 'แก้ไขคำถามที่พบบ่อย' : 'เพิ่มคำถามที่พบบ่อย'} size="lg">
      <div className="flex flex-col gap-4">
        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            คำถาม<span className="text-destructive">*</span>
          </label>
          <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="เช่น เติมเหรียญยังไง" maxLength={300} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            คำตอบ<span className="text-destructive">*</span>
          </label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={5}
            maxLength={3000}
            placeholder="พิมพ์คำตอบ..."
            className="w-full resize-none rounded-xl border border-input/90 bg-card/75 px-3 py-2 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">ลำดับการแสดง</label>
          <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-24" />
          <p className="mt-1 text-xs text-muted-foreground">เลขน้อยแสดงก่อน</p>
        </div>

        {isEdit && (
          <label className="flex cursor-pointer items-center gap-2">
            <Switch checked={status} onCheckedChange={setStatus} />
            <span className="text-sm text-foreground">แสดงผล (ปิด = ซ่อนจากหน้าติดต่อแอดมิน)</span>
          </label>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            ยกเลิก
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
