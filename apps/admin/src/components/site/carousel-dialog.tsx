'use client'

/**
 * components/site/carousel-dialog.tsx — เพิ่ม/แก้ไข carousel (2026-08-04, ใหม่)
 * ใช้ Modal ของ apps/admin เอง เปิด/ปิดคุมจาก parent — โหมดเดียวกันครอบทั้งสร้างและแก้ไข
 * (carousel: null = สร้างใหม่, มีค่า = แก้ไข)
 */

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { DragDropImage } from './drag-drop-image'
import { api } from '@/lib/api'
import type { CarouselRow } from '@/types'

const DEFAULT_DISPLAY_SECONDS = '5'

// <input type="datetime-local"> ต้องการ "YYYY-MM-DDTHH:mm" (เวลาท้องถิ่น ไม่มี timezone/วินาที)
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function CarouselDialog({
  carousel,
  open,
  onClose,
  onSaved,
}: {
  carousel: CarouselRow | null
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = carousel !== null

  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [note, setNote] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [status, setStatus] = useState(true)
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [displaySeconds, setDisplaySeconds] = useState(DEFAULT_DISPLAY_SECONDS)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (carousel) {
      setImageFile(null)
      setImagePreview(carousel.image_path)
      setTitle(carousel.title ?? '')
      setSubtitle(carousel.subtitle ?? '')
      setNote(carousel.note ?? '')
      setLinkUrl(carousel.link_url ?? '')
      setStatus(carousel.status === 'active')
      setStartAt(toDatetimeLocal(carousel.start_at))
      setEndAt(toDatetimeLocal(carousel.end_at))
      setDisplaySeconds(carousel.display_seconds)
    } else {
      setImageFile(null)
      setImagePreview(null)
      setTitle('')
      setSubtitle('')
      setNote('')
      setLinkUrl('')
      setStatus(true)
      setStartAt(toDatetimeLocal(new Date().toISOString()))
      setEndAt('')
      setDisplaySeconds(DEFAULT_DISPLAY_SECONDS)
    }
    setError(null)
  }, [open, carousel])

  async function handleSave() {
    setError(null)
    if (!title.trim()) {
      setError('กรุณาใส่ชื่อปก')
      return
    }
    if (!isEdit && !imageFile) {
      setError('กรุณาใส่รูปก่อน')
      return
    }

    const formData = new FormData()
    formData.append('title', title.trim())
    formData.append('subtitle', subtitle.trim())
    formData.append('note', note.trim())
    formData.append('link_url', linkUrl.trim())
    formData.append('status', status ? 'active' : 'inactive')
    if (startAt) formData.append('start_at', new Date(startAt).toISOString())
    formData.append('end_at', endAt ? new Date(endAt).toISOString() : '')
    formData.append('display_seconds', displaySeconds || DEFAULT_DISPLAY_SECONDS)
    if (imageFile) formData.append('image', imageFile)

    setSaving(true)
    try {
      if (isEdit) {
        await api.patch(`/admin/carousels/${carousel.id}`, formData)
      } else {
        await api.post('/admin/carousels', formData)
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
    <Modal open={open} onClose={() => !saving && onClose()} size="lg" title={isEdit ? 'แก้ไข Carousel' : 'เพิ่ม Carousel'}>
      <div className="flex flex-col gap-4">
        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <DragDropImage
          preview={imagePreview}
          onFileSelected={(file) => {
            setImageFile(file)
            setImagePreview(URL.createObjectURL(file))
          }}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              ชื่อปก<span className="text-destructive">*</span>
            </label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ชื่อที่โชว์บนแบนเนอร์" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">คำโปรยใต้ชื่อ (โชว์บนเว็บ)</label>
            <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="ข้อความเสริมใต้ชื่อ" />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">หมายเหตุ (ภายใน — ไม่โชว์บนเว็บ)</label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="จดไว้เตือนตัวเอง เช่น โปรโมชั่นอะไร" />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">ลิงก์ปลายทาง</label>
          <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="/works/xxxx หรือ URL เต็ม" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">วันที่เผยแพร่</label>
            <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">วันที่สิ้นสุดการเผยแพร่</label>
            <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">เว้นว่าง = ไม่มีกำหนดสิ้นสุด (โชว์เป็น &quot;-&quot;)</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <label className="mb-1.5 block text-sm font-medium text-foreground">เวลาที่แสดงก่อนเปลี่ยน (วินาที)</label>
            <Input
              type="number"
              min={0.5}
              step={0.1}
              value={displaySeconds}
              onChange={(e) => setDisplaySeconds(e.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 pb-1.5">
            <Switch checked={status} onCheckedChange={setStatus} />
            <span className="text-sm text-foreground">เปิดใช้งาน</span>
          </label>
        </div>

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
