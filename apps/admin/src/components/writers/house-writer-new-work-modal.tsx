'use client'

/**
 * components/writers/house-writer-new-work-modal.tsx — "เพิ่มนิยายใหม่" (2026-08-10, ใหม่)
 *
 * ตั้งใจให้เรียบง่ายกว่าฟอร์ม /writer/works/new ของนักเขียนจริง (ไม่มีหมวดหมู่/แท็ก/คำโปรย ฯลฯ
 * ตรงนี้) — ใส่แค่ชื่อเรื่อง + ปก (ไม่บังคับ) แล้วไป "แก้ไข" รายละเอียดที่เหลือทีหลังผ่านหน้า
 * /works/[uuid] เดิม (เหมือน pattern เดียวกับที่ user ขอไว้สำหรับ "เพิ่มนิยายหลายเรื่อง")
 * publish_status เป็น 0 (ซ่อน) เสมอโดยธรรมชาติ — createWork ของ writer.service.ts บังคับไว้แล้ว
 */

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { EditableCover } from '@/components/works/editable-cover'
import { api } from '@/lib/api'

export function HouseWriterNewWorkModal({
  targetUuid,
  onClose,
  onCreated,
}: {
  targetUuid: string
  onClose: () => void
  onCreated: (workUuid: string) => void
}) {
  const [title, setTitle] = useState('')
  const [cover, setCover] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!title.trim()) {
      setError('กรุณากรอกชื่อเรื่องก่อน')
      return
    }

    setError(null)
    setSaving(true)
    try {
      const work = await api
        .post<{ data: { uuid: string } }>(`/admin/house-writers/${targetUuid}/works`, {
          title: title.trim(),
          type: 'novel',
        })
        .then((res) => res.data)

      if (cover) {
        const formData = new FormData()
        formData.append('cover', cover)
        await api.post(`/admin/works/${work.uuid}/cover`, formData)
      }

      onCreated(work.uuid)
    } catch (err: any) {
      setError(err?.message ?? 'เพิ่มนิยายไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="เพิ่มนิยายใหม่">
      <div className="flex flex-col gap-4">
        <div className="flex justify-center">
          <EditableCover src={null} onChange={setCover} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">ชื่อเรื่อง</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          ตั้งค่าอื่น (หมวดหมู่ แท็ก คำโปรย ฯลฯ) แก้เพิ่มเติมได้ทีหลังผ่านหน้าแก้ไขผลงาน — เรื่องนี้จะถูกซ่อนไว้
          (ยังไม่เผยแพร่) จนกว่าจะกดเผยแพร่เอง
        </p>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="button" onClick={handleCreate} disabled={saving}>
            {saving ? 'กำลังบันทึก...' : 'เพิ่มนิยาย'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
