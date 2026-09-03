'use client'

/**
 * components/site/carousel-tab.tsx — แท็บ "จัดการ Carousel" (2026-08-04, ใหม่)
 *
 * ระบบลิสต์ลาก-วางจัดลำดับ: อันแรก = โชว์ตอนเข้าเว็บครั้งแรก, ถัดไปวนขวา, สุดท้ายวนกลับมาซ้าย
 * (Embla loop:true ฝั่งเว็บจริงอยู่แล้ว — ดู hero-carousel.tsx) — ลาก reorder ในนี้แค่เปลี่ยนลำดับ
 * ในหน้าจอก่อน (local state) ต้องกด "บันทึก" ถึงจะยิง PATCH /admin/carousels/reorder จริง
 * กด "รีเซ็ต" = ทิ้งการลากที่ยังไม่บันทึก กลับไปลำดับล่าสุดที่เซิร์ฟเวอร์มี
 */

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Plus, Settings2, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { CarouselDialog } from './carousel-dialog'
import { api } from '@/lib/api'
import { cn, formatThaiDateTime } from '@/lib/utils'
import type { CarouselRow } from '@/types'

export function CarouselTab() {
  const queryClient = useQueryClient()
  const [order, setOrder] = useState<CarouselRow[]>([])
  const [dirty, setDirty] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCarousel, setEditingCarousel] = useState<CarouselRow | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const dragIndex = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'carousels'],
    queryFn: () => api.get<{ data: CarouselRow[] }>('/admin/carousels').then((res) => res.data),
  })

  useEffect(() => {
    if (query.data) {
      setOrder(query.data)
      setDirty(false)
    }
  }, [query.data])

  function handleDrop(index: number) {
    if (dragIndex.current !== null && dragIndex.current !== index) {
      setOrder((prev) => {
        const next = [...prev]
        const [moved] = next.splice(dragIndex.current!, 1)
        next.splice(index, 0, moved)
        return next
      })
      setDirty(true)
    }
    dragIndex.current = null
    setDragOverIndex(null)
  }

  async function handleSaveOrder() {
    setError(null)
    setSavingOrder(true)
    try {
      await api.patch('/admin/carousels/reorder', { ids: order.map((c) => c.id) })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'carousels'] })
      await queryClient.invalidateQueries({ queryKey: ['carousels'] }) // cache ฝั่งเว็บจริง (ถ้า query client เดียวกันไม่มีผล แต่กันไว้)
      setDirty(false)
    } catch (err: any) {
      setError(err?.message ?? 'บันทึกลำดับไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setSavingOrder(false)
    }
  }

  function handleResetOrder() {
    if (query.data) setOrder(query.data)
    setDirty(false)
  }

  async function handleDelete(carousel: CarouselRow) {
    if (!window.confirm(`ลบ carousel "${carousel.title ?? '(ไม่มีชื่อ)'}" ใช่หรือไม่?`)) return
    setError(null)
    setBusyId(carousel.id)
    try {
      await api.delete(`/admin/carousels/${carousel.id}`)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'carousels'] })
    } catch (err: any) {
      setError(err?.message ?? 'ลบไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            className="h-9 gap-1.5"
            onClick={() => {
              setEditingCarousel(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4" />
            เพิ่ม
          </Button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="ตั้งค่า"
            title="ตั้งค่า"
            className="flex size-9 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
          >
            <Settings2 className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" disabled={!dirty || savingOrder} onClick={handleResetOrder}>
            รีเซ็ต
          </Button>
          <Button type="button" disabled={!dirty || savingOrder} onClick={handleSaveOrder}>
            {savingOrder ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {query.isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : order.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card py-16">
          <p className="text-sm text-muted-foreground">ยังไม่มี carousel — กด &quot;เพิ่ม&quot; เพื่อเริ่มต้น</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {order.map((c, index) => (
            <div
              key={c.id}
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
                'flex cursor-grab items-center gap-3 rounded-xl border border-border bg-card p-3 active:cursor-grabbing',
                dragOverIndex === index && 'border-primary bg-primary/5',
              )}
            >
              <GripVertical className="size-4 shrink-0 text-muted-foreground" />
              <span className="w-6 shrink-0 text-center text-sm font-medium text-foreground">{index + 1}</span>
              <img src={c.image_path} alt={c.title ?? ''} className="h-12 w-20 shrink-0 rounded-md object-cover bg-muted" />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">{c.title || '(ไม่มีชื่อ)'}</span>
                  {c.status === 'inactive' && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">ปิดใช้งาน</span>
                  )}
                </div>
                {c.note && <p className="truncate text-xs text-muted-foreground">หมายเหตุ: {c.note}</p>}
              </div>

              <div className="hidden shrink-0 flex-col text-xs text-muted-foreground sm:flex">
                <span>เผยแพร่: {formatThaiDateTime(c.start_at)}</span>
                <span>สิ้นสุด: {c.end_at ? formatThaiDateTime(c.end_at) : '-'}</span>
              </div>
              <div className="hidden w-20 shrink-0 text-center text-xs text-muted-foreground md:block">
                {Number(c.display_seconds)} วิ
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingCarousel(c)
                    setDialogOpen(true)
                  }}
                  className="flex cursor-pointer items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Pencil className="size-3.5" />
                  แก้ไข
                </button>
                <button
                  type="button"
                  disabled={busyId === c.id}
                  onClick={() => handleDelete(c)}
                  className="flex cursor-pointer items-center gap-1 text-sm text-destructive hover:underline disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                  ลบ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CarouselDialog
        carousel={editingCarousel}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['admin', 'carousels'] })}
      />

      <CarouselDefaultsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

// ---- ตั้งค่าเริ่มต้น (ปุ่มฟันเฟือง) — ค่า default "เวลาที่แสดงก่อนเปลี่ยน" สำหรับ carousel ใหม่
// ที่จะเพิ่มต่อจากนี้ (ไม่กระทบของเดิม) เก็บผ่าน web_setting (key-value เดิมของระบบ)
function CarouselDefaultsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [value, setValue] = useState('5')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get<{ data: Record<string, string> }>('/admin/settings').then((res) => res.data),
    enabled: open,
  })

  useEffect(() => {
    if (query.data?.carousel_default_display_seconds) {
      setValue(query.data.carousel_default_display_seconds)
    }
  }, [query.data])

  async function handleSave() {
    setError(null)
    setSaving(true)
    try {
      await api.patch('/admin/settings', { carousel_default_display_seconds: value || '5' })
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={() => !saving && onClose()} title="ตั้งค่าเริ่มต้น Carousel">
      <div className="flex flex-col gap-4">
        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            เวลาที่แสดงก่อนเปลี่ยนสไลด์เริ่มต้น (วินาที)
          </label>
          <Input type="number" min={0.5} step={0.1} value={value} onChange={(e) => setValue(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">มีผลกับ carousel ที่เพิ่มใหม่ต่อจากนี้เท่านั้น</p>
        </div>
        <div className="flex justify-end gap-2">
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
