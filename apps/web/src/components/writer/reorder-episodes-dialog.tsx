'use client'

import { useEffect, useRef, useState } from 'react'
import { GripVertical, ListOrdered } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { WriterEpisodeRow } from './episode-list-table'

// ลาก-วางจัดลำดับตอนใหม่ แล้วบันทึกจริงผ่าน PATCH /writer/episodes/:ep_id ทีละตอน
//
// ep_no คงชุดตัวเลขเดิมไว้ (ไม่ renumber เป็น 1,2,3... ใหม่หมด) แค่สลับว่าตอนไหนได้เลขไหน
// ตามลำดับใหม่ที่ลาก — เพราะ ep_no รองรับเลขกำหนดเอง/มีช่องว่างได้ (migration 010, "คำเรียกตอน")
// ถ้า renumber ทับหมดจะทำลาย numbering ที่นักเขียนตั้งใจไว้เอง
//
// บันทึกแบบ 2 รอบ (2-phase) เพราะ (p_id, ep_no) มี unique constraint จริงที่ DB — สลับเลขตรงๆ
// ทีเดียวจะชนกัน (เช่นสลับ 1↔2 จะเจอ EP_NO_TAKEN ทันที) ต้องย้ายไปเลขชั่วคราวที่ไม่ชนใครก่อน
// (offset สูงมากพอที่ไม่มีทางชนกับ ep_no จริงของเรื่องไหนเลย) แล้วค่อยย้ายไปเลขจริงรอบสอง
const TEMP_EP_NO_OFFSET = 1_000_000

export function ReorderEpisodesDialog({
  episodes,
  onReordered,
  trigger,
}: {
  episodes: WriterEpisodeRow[]
  onReordered: () => void
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [order, setOrder] = useState<WriterEpisodeRow[]>([])
  const [saving, setSaving] = useState(false)
  const dragIndex = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => {
    if (open) {
      setOrder([...episodes].sort((a, b) => a.ep_no - b.ep_no))
    }
  }, [open, episodes])

  function handleDrop(index: number) {
    if (dragIndex.current !== null && dragIndex.current !== index) {
      setOrder((prev) => {
        const next = [...prev]
        const [moved] = next.splice(dragIndex.current!, 1)
        next.splice(index, 0, moved)
        return next
      })
    }
    dragIndex.current = null
    setDragOverIndex(null)
  }

  async function handleSave() {
    // ชุดเลขเดิม (เรียงแล้ว) เอามาแจกใหม่ตามลำดับที่ลากได้ — ไม่สร้างเลขใหม่ขึ้นมาเอง
    const sortedEpNos = [...episodes].map((ep) => ep.ep_no).sort((a, b) => a - b)
    const changed = order
      .map((ep, i) => ({ ep, newEpNo: sortedEpNos[i] }))
      .filter(({ ep, newEpNo }) => ep.ep_no !== newEpNo)

    if (changed.length === 0) {
      setOpen(false)
      return
    }

    setSaving(true)
    try {
      // รอบ 1: ย้ายตอนที่เลขเปลี่ยนไปเลขชั่วคราวที่ไม่ชนใครก่อน กัน unique constraint (p_id, ep_no) ชน
      await Promise.all(
        changed.map(({ ep }, i) =>
          api.patch(`/writer/episodes/${ep.ep_id}`, { ep_no: TEMP_EP_NO_OFFSET + i }),
        ),
      )
      // รอบ 2: ย้ายไปเลขจริงตามลำดับใหม่
      await Promise.all(
        changed.map(({ ep, newEpNo }) => api.patch(`/writer/episodes/${ep.ep_id}`, { ep_no: newEpNo })),
      )

      setOpen(false)
      onReordered()
    } catch (err: any) {
      onReordered() // เผื่อบันทึกไปสำเร็จบางส่วนแล้ว ให้ดึงสถานะจริงล่าสุดมาแสดงแทนของค้าง
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListOrdered className="size-4" />
            จัดลำดับตอน
          </DialogTitle>
        </DialogHeader>

        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
          {order.map((ep, index) => (
            <div
              key={ep.ep_id}
              draggable
              onDragStart={() => {
                dragIndex.current = index
              }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverIndex(index)
              }}
              onDrop={() => handleDrop(index)}
              onDragEnd={() => {
                dragIndex.current = null
                setDragOverIndex(null)
              }}
              className={cn(
                'flex cursor-grab items-center gap-3 rounded-lg border border-input bg-card px-3 py-2.5 text-sm active:cursor-grabbing',
                dragOverIndex === index && 'border-primary bg-primary/5',
              )}
            >
              <GripVertical className="size-4 shrink-0 text-muted-foreground" />
              <span className="w-6 shrink-0 text-center font-medium text-foreground">{index + 1}</span>
              <span className="flex-1 truncate text-foreground">{ep.ep_name}</span>
            </div>
          ))}
          {order.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีตอนให้จัดลำดับ</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="destructive"
            onClick={() => setOpen(false)}
            disabled={saving}
            className="rounded-full"
          >
            ยกเลิก
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || order.length === 0} className="rounded-full">
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
