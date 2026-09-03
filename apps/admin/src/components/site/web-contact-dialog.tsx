'use client'

/**
 * components/site/web-contact-dialog.tsx — เพิ่ม/แก้ไขช่องทางติดต่อ (2026-08-18, ใหม่)
 * โหมดเดียวครอบทั้งสร้างและแก้ไข (contact: null = สร้างใหม่) เหมือน category-dialog.tsx
 * icon_class เป็นคำ keyword ธรรมดา (เช่น "line", "mail", "discord") ไม่ใช่ CSS class จริง —
 * ฝั่งแสดงผล (footer + หน้าติดต่อแอดมิน) เดาไอคอน Lucide จาก keyword นี้ (ดู lib/contact-icon.ts)
 */

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import type { WebContactAdminRow } from '@/types'

export function WebContactDialog({
  contact,
  open,
  onClose,
  onSaved,
}: {
  contact: WebContactAdminRow | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = contact !== null

  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const [iconClass, setIconClass] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [status, setStatus] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (contact) {
      setLabel(contact.label)
      setUrl(contact.url)
      setIconClass(contact.icon_class ?? '')
      setSortOrder(String(contact.sort_order))
      setStatus(contact.status)
    } else {
      setLabel('')
      setUrl('')
      setIconClass('')
      setSortOrder('0')
      setStatus(true)
    }
    setError(null)
  }, [open, contact])

  async function handleSave() {
    setError(null)
    if (!label.trim()) {
      setError('กรุณาใส่ชื่อช่องทาง')
      return
    }
    if (!url.trim()) {
      setError('กรุณาใส่ลิงก์')
      return
    }

    const body = {
      label: label.trim(),
      url: url.trim(),
      icon_class: iconClass.trim() || null,
      sort_order: Number(sortOrder) || 0,
    }

    setSaving(true)
    try {
      if (isEdit) {
        await api.patch(`/admin/web-contacts/${contact.id}`, { ...body, status })
      } else {
        await api.post('/admin/web-contacts', body)
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
    <Modal open={open} onClose={() => !saving && onClose()} title={isEdit ? 'แก้ไขช่องทางติดต่อ' : 'เพิ่มช่องทางติดต่อ'}>
      <div className="flex flex-col gap-4">
        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            ชื่อช่องทาง<span className="text-destructive">*</span>
          </label>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="เช่น Discord, Facebook, อีเมล" maxLength={100} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            ลิงก์<span className="text-destructive">*</span>
          </label>
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." maxLength={500} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">คำใบ้ไอคอน (ไม่บังคับ)</label>
          <Input value={iconClass} onChange={(e) => setIconClass(e.target.value)} placeholder="เช่น mail, line, chat" maxLength={50} className="w-40" />
          <p className="mt-1 text-xs text-muted-foreground">ระบบเดาไอคอนจากคำนี้ (mail/email → ซองจดหมาย, line/chat/message → แชท) เว้นว่างไว้ใช้ไอคอนโลกทั่วไป</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">ลำดับการแสดง</label>
          <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-24" />
          <p className="mt-1 text-xs text-muted-foreground">เลขน้อยแสดงก่อน</p>
        </div>

        {isEdit && (
          <label className="flex cursor-pointer items-center gap-2">
            <Switch checked={status} onCheckedChange={setStatus} />
            <span className="text-sm text-foreground">แสดงผล (ปิด = ซ่อนจาก Footer และหน้าติดต่อแอดมิน)</span>
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
