'use client'

/**
 * components/site/category-dialog.tsx — เพิ่ม/แก้ไขหมวดหมู่ (2026-08-17, ใหม่)
 * โหมดเดียวครอบทั้งสร้างและแก้ไข (category: null = สร้างใหม่) เหมือน announcement-dialog.tsx —
 * ไอคอนเป็นช่อง emoji ธรรมดา (ไม่มี picker) โชว์บนแถบหมวดหมู่หน้าแรกโดยตรง (คนละอันกับ Carousel
 * แบนเนอร์รูปภาพในแท็บ "จัดการ Carousel" — แถบหมวดหมู่เป็นรายการหมวดหมู่ที่เลื่อนได้ ไม่ใช่รูป)
 * เว้นว่างไว้ได้ (fallback 📚)
 */

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import type { CategoryAdminRow } from '@/types'

export function CategoryDialog({
  category,
  open,
  onClose,
  onSaved,
}: {
  category: CategoryAdminRow | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = category !== null

  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [status, setStatus] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (category) {
      setName(category.name)
      setIcon(category.icon ?? '')
      setStatus(category.status)
    } else {
      setName('')
      setIcon('')
      setStatus(true)
    }
    setError(null)
  }, [open, category])

  async function handleSave() {
    setError(null)
    if (!name.trim()) {
      setError('กรุณาใส่ชื่อหมวดหมู่')
      return
    }

    setSaving(true)
    try {
      if (isEdit) {
        await api.patch(`/admin/categories/${category.id}`, {
          name: name.trim(),
          icon: icon.trim() || null,
          status,
        })
      } else {
        await api.post('/admin/categories', { name: name.trim(), icon: icon.trim() || null })
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
    <Modal open={open} onClose={() => !saving && onClose()} title={isEdit ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่'}>
      <div className="flex flex-col gap-4">
        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            ชื่อหมวดหมู่<span className="text-destructive">*</span>
          </label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น รักโรแมนติก" maxLength={50} />
          <p className="mt-1 text-xs text-muted-foreground">เปลี่ยนชื่อแล้วอัพเดททั้งเว็บทันที (การ์ดผลงาน, ตัวกรองค้นหา, แถบหมวดหมู่หน้าแรก)</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">ไอคอน (emoji)</label>
          <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="📚" maxLength={10} className="w-24 text-center text-lg" />
          <p className="mt-1 text-xs text-muted-foreground">โชว์บนวงกลมไอคอนของแถบหมวดหมู่หน้าแรก เว้นว่างไว้ใช้ 📚 แทน</p>
        </div>

        {isEdit && (
          <label className="flex cursor-pointer items-center gap-2">
            <Switch checked={status} onCheckedChange={setStatus} />
            <span className="text-sm text-foreground">เปิดการมองเห็น (ปิด = หายจากแถบหมวดหมู่หน้าแรก/ตัวกรองค้นหา/dropdown เลือกหมวดตอนเขียนนิยาย — ไม่เกี่ยวกับ Carousel แบนเนอร์รูปภาพ)</span>
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
