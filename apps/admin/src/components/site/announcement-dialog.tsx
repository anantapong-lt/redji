'use client'

/**
 * components/site/announcement-dialog.tsx — เพิ่ม/แก้ไขประกาศ (2026-08-11, ใหม่)
 * โหมดเดียวครอบทั้งสร้างและแก้ไข (announcement: null = สร้างใหม่, มีค่า = แก้ไข) เหมือน
 * carousel-dialog.tsx — ทุกช่อง (หัวข้อ/ข้อความ/สี/เปิดใช้งาน) เป็นแค่ local state ล้วนๆ
 * ไม่ยิง API จนกว่าจะกด "บันทึก" เท่านั้น
 */

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { AnnouncementRow } from '@/types'

// พรีเซ็ตสีที่ user ขอ (2026-08-11): เขียว/แดง/ม่วง/ทอง — จำกัดเป็น preset ไม่ใช่ free-form
// hex picker กันแอดมินเลือกสีที่กลืนพื้นหลัง/อ่านไม่ออกโดยไม่ตั้งใจ ต้องตรงกับ
// COLOR_GRADIENTS ฝั่ง apps/web/announcement-bar.tsx เป๊ะๆ (คนละไฟล์เพราะคนละแอป ไม่ได้ share
// โค้ดกัน) และ CHECK constraint ของคอลัมน์ color (migration 045)
const COLOR_PRESETS = [
  { key: 'green', label: 'เขียว', className: 'bg-gradient-to-br from-emerald-500 to-green-700' },
  { key: 'red', label: 'แดง', className: 'bg-gradient-to-br from-red-500 to-rose-700' },
  { key: 'purple', label: 'ม่วง', className: 'bg-gradient-to-br from-purple-500 to-violet-700' },
  { key: 'gold', label: 'ทอง', className: 'bg-gradient-to-br from-amber-400 to-yellow-600' },
] as const

export function AnnouncementDialog({
  announcement,
  open,
  onClose,
  onSaved,
}: {
  announcement: AnnouncementRow | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = announcement !== null

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [status, setStatus] = useState(true)
  const [color, setColor] = useState<'green' | 'red' | 'purple' | 'gold'>('gold')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (announcement) {
      setTitle(announcement.title)
      setContent(announcement.content)
      setStatus(announcement.status === 'active')
      setColor(announcement.color)
    } else {
      setTitle('')
      setContent('')
      setStatus(true)
      setColor('gold')
    }
    setError(null)
  }, [open, announcement])

  async function handleSave() {
    setError(null)
    if (!title.trim()) {
      setError('กรุณาใส่หัวข้อประกาศ')
      return
    }
    if (!content.trim()) {
      setError('กรุณาใส่ข้อความประกาศ')
      return
    }

    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        content: content.trim(),
        status: status ? 'active' : 'inactive',
        color,
      }
      if (isEdit) {
        await api.patch(`/admin/announcements/${announcement.id}`, payload)
      } else {
        await api.post('/admin/announcements', payload)
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
    <Modal open={open} onClose={() => !saving && onClose()} title={isEdit ? 'แก้ไขประกาศ' : 'เพิ่มประกาศ'}>
      <div className="flex flex-col gap-4">
        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            หัวข้อ<span className="text-destructive">*</span>
          </label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น แจ้งปิดปรับปรุงระบบ" />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            ข้อความ<span className="text-destructive">*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder="รายละเอียดที่จะโชว์บนแถบประกาศ"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">สีแถบประกาศ</label>
          <div className="flex gap-2.5">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => setColor(preset.key)}
                title={preset.label}
                className={cn(
                  'flex h-10 flex-1 cursor-pointer items-center justify-center rounded-lg text-xs font-semibold text-white shadow-sm transition-all',
                  preset.className,
                  color === preset.key ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card' : 'opacity-60 hover:opacity-100',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <Switch checked={status} onCheckedChange={setStatus} />
          <span className="text-sm text-foreground">เปิดใช้งาน</span>
        </label>

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
