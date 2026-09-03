'use client'

/**
 * components/site/featured-tab.tsx — แท็บ "นิยายแนะนำ" (2026-08-04, ใหม่ / 2026-08-05 แก้ผัง)
 *
 * "จำลองหน้า Home" ตารางแบ่ง 3 คอลัมน์ตามหัวข้อ (ตรงกับ 3 แถวจริงบนหน้าแรก: sales/popular/latest)
 * แต่ละคอลัมน์โชว์ของบูสต์ (แก้ไข/ลาก-จัดลำดับ/ลบได้) ตามด้วยของจริงที่ติดอันดับเอง (แก้ไม่ได้
 * เลย — badge "ยอดจริง" สีเขียว) ตัวเลขสถิติทุกตัวเป็นของจริง 100% เสมอ (user ยืนยันแล้ว
 * 2026-08-04 — ไม่มีช่องให้พิมพ์เลขปลอมแทน)
 *
 * 2026-08-05 แก้ผัง (user ขอ): ส่วนของบูสต์แสดงเป็น "ช่อง" ตายตัวจำนวน recommendedMax ช่อง
 * (เหมือน Carousel ที่เห็นจำนวนช่องรอไว้เลย) ช่องว่าง = การ์ดเส้นประ + ปุ่ม "+" ตรงกลางในตัวช่องเอง
 * (ย้ายจากปุ่ม "+ เพิ่ม" มุมขวาบนเดิม) ช่องที่มีของ = ไฮไลท์เหลือง pastel ปุ่มมุมขวาบนเดิมเปลี่ยนเป็น
 * "รีเซ็ต" แทน — กดแล้วเคลียร์ของบูสต์ทั้งคอลัมน์นั้นออกหมดแล้ว refetch ใหม่
 *
 * ลากจัดลำดับของบูสต์ในกลุ่มช่องที่มีของ (ช่องว่างลากไม่ได้/วางไม่ได้) = local state ก่อน ต้องกด
 * "บันทึก" ถึงจะยิง PATCH /admin/featured-works/reorder จริง (เหมือนแท็บ Carousel)
 */

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Plus, RotateCcw, X, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FeaturedPickerDialog } from './featured-picker-dialog'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { FeaturedPreviewRow } from '@/types'

const SECTIONS = ['sales', 'popular', 'latest'] as const
type Section = (typeof SECTIONS)[number]

const SECTION_LABEL: Record<Section, string> = {
  sales: 'เรื่องเด่นประจำสัปดาห์',
  popular: 'นิยมตลอดกาล',
  latest: 'ใหม่ล่าสุด',
}

function daysRemaining(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
}

export function FeaturedTab() {
  const queryClient = useQueryClient()
  const [order, setOrder] = useState<Record<Section, FeaturedPreviewRow[]>>({ sales: [], popular: [], latest: [] })
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickerSection, setPickerSection] = useState<Section | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [resettingSection, setResettingSection] = useState<Section | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'featured-preview'],
    queryFn: () => api.get<{ data: Record<Section, FeaturedPreviewRow[]>; recommended_max: number }>('/admin/featured-works/preview'),
  })

  useEffect(() => {
    if (query.data) {
      setOrder(query.data.data)
      setDirty(false)
    }
  }, [query.data])

  const recommendedMax = query.data?.recommended_max ?? 2

  async function handleSaveOrder() {
    setError(null)
    setSaving(true)
    try {
      for (const section of SECTIONS) {
        const boosted = order[section].filter((r) => r.is_boosted)
        await api.patch('/admin/featured-works/reorder', {
          section,
          ids: boosted.map((r) => r.featured_id as string),
        })
      }
      await queryClient.invalidateQueries({ queryKey: ['admin', 'featured-preview'] })
      setDirty(false)
    } catch (err: any) {
      setError(err?.message ?? 'บันทึกลำดับไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setSaving(false)
    }
  }

  function handleResetOrder() {
    if (query.data) setOrder(query.data.data)
    setDirty(false)
  }

  async function handleRemove(row: FeaturedPreviewRow) {
    if (!row.featured_id) return
    if (!window.confirm(`เอา "${row.title}" ออกจากคิวบูสต์ใช่หรือไม่?`)) return
    setError(null)
    setBusyId(row.featured_id)
    try {
      await api.delete(`/admin/featured-works/${row.featured_id}`)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'featured-preview'] })
    } catch (err: any) {
      setError(err?.message ?? 'เอาออกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusyId(null)
    }
  }

  async function handleResetSection(section: Section) {
    const boosted = order[section].filter((r) => r.is_boosted)
    if (boosted.length === 0) return
    if (!window.confirm(`เอาเรื่องบูสต์ทั้งหมดใน "${SECTION_LABEL[section]}" ออกทั้งหมด (${boosted.length} เรื่อง) ใช่หรือไม่?`)) return
    setError(null)
    setResettingSection(section)
    try {
      for (const row of boosted) {
        if (row.featured_id) await api.delete(`/admin/featured-works/${row.featured_id}`)
      }
      await queryClient.invalidateQueries({ queryKey: ['admin', 'featured-preview'] })
    } catch (err: any) {
      setError(err?.message ?? 'รีเซ็ตไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setResettingSection(null)
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          แนะนำ: ไม่ควรใส่เกิน {recommendedMax} เรื่องต่อคอลัมน์ — เยอะเกินไปอาจทำให้เว็บดูไม่สดใหม่
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" disabled={!dirty || saving} onClick={handleResetOrder}>
            ยกเลิก
          </Button>
          <Button type="button" disabled={!dirty || saving} onClick={handleSaveOrder}>
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
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
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {SECTIONS.map((section) => (
            <SectionColumn
              key={section}
              section={section}
              rows={order[section]}
              recommendedMax={recommendedMax}
              busyId={busyId}
              resetting={resettingSection === section}
              onOrderChange={(rows) => {
                setOrder((prev) => ({ ...prev, [section]: rows }))
                setDirty(true)
              }}
              onAdd={() => setPickerSection(section)}
              onRemove={handleRemove}
              onReset={() => handleResetSection(section)}
            />
          ))}
        </div>
      )}

      <FeaturedPickerDialog
        section={pickerSection}
        open={pickerSection !== null}
        onClose={() => setPickerSection(null)}
        onAdded={() => queryClient.invalidateQueries({ queryKey: ['admin', 'featured-preview'] })}
      />
    </div>
  )
}

function SectionColumn({
  section,
  rows,
  recommendedMax,
  busyId,
  resetting,
  onOrderChange,
  onAdd,
  onRemove,
  onReset,
}: {
  section: Section
  rows: FeaturedPreviewRow[]
  recommendedMax: number
  busyId: string | null
  resetting: boolean
  onOrderChange: (rows: FeaturedPreviewRow[]) => void
  onAdd: () => void
  onRemove: (row: FeaturedPreviewRow) => void
  onReset: () => void
}) {
  const boosted = rows.filter((r) => r.is_boosted)
  const organic = rows.filter((r) => !r.is_boosted)
  const slotCount = Math.max(recommendedMax, boosted.length)
  const slots: (FeaturedPreviewRow | null)[] = Array.from({ length: slotCount }, (_, i) => boosted[i] ?? null)

  const dragIndex = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function handleDrop(targetIndex: number) {
    const from = dragIndex.current
    dragIndex.current = null
    setDragOverIndex(null)
    // ลากสลับได้เฉพาะระหว่างช่องที่มีของบูสต์อยู่จริงเท่านั้น (ช่องว่างลากเข้า/ออกไม่ได้)
    if (from === null || from === targetIndex) return
    if (!slots[from] || !slots[targetIndex]) return
    const nextBoosted = [...boosted]
    const [moved] = nextBoosted.splice(from, 1)
    nextBoosted.splice(targetIndex, 0, moved)
    onOrderChange([...nextBoosted, ...organic])
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">{SECTION_LABEL[section]}</h3>
        <button
          type="button"
          disabled={resetting || boosted.length === 0}
          onClick={onReset}
          className="flex cursor-pointer items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RotateCcw className="size-3.5" />
          {resetting ? 'กำลังรีเซ็ต...' : 'รีเซ็ต'}
        </button>
      </div>

      {boosted.length > recommendedMax && (
        <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700">
          <TriangleAlert className="size-3.5 shrink-0" />
          ใส่ไป {boosted.length} เรื่องแล้ว (แนะนำไม่เกิน {recommendedMax})
        </div>
      )}

      {/* ช่องบูสต์ตายตัวจำนวน slotCount ช่อง — มีของ = การ์ดไฮไลท์เหลือง pastel, ว่าง = การ์ดเส้นประ + ปุ่ม "+" กลางช่อง */}
      <div className="flex flex-col gap-1.5">
        {slots.map((row, index) =>
          row ? (
            <div
              key={row.uuid}
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
                'flex cursor-grab items-center gap-2 rounded-lg border border-yellow-300/60 bg-yellow-300/20 p-2 text-xs active:cursor-grabbing',
                dragOverIndex === index && 'border-primary bg-primary/5',
              )}
            >
              <GripVertical className="size-3.5 shrink-0 text-muted-foreground" />
              <img
                src={row.cover_image ?? undefined}
                alt={row.title}
                className="h-10 w-7 shrink-0 rounded bg-muted object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground" title={row.title}>
                  {row.title}
                </p>
                <div className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground">
                  <span>อ่าน/วัน {row.reads_today}</span>
                  <span>รวม {row.total_reads}</span>
                  <span>{row.episode_count} ตอน</span>
                  <span>{row.monthly_earning} เหรียญ/เดือน</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="block text-[10px] font-medium text-amber-700">อีก {daysRemaining(row.expires_at!)} วัน</span>
                <button
                  type="button"
                  disabled={busyId === row.featured_id}
                  onClick={() => onRemove(row)}
                  className="mt-0.5 flex cursor-pointer items-center gap-0.5 text-[10px] text-destructive hover:underline disabled:opacity-50"
                >
                  <X className="size-3" />
                  เอาออก
                </button>
              </div>
            </div>
          ) : (
            <button
              key={`empty-${index}`}
              type="button"
              onClick={onAdd}
              onDragOver={(e) => e.preventDefault()}
              className="flex h-[52px] shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus className="size-4" />
            </button>
          ),
        )}
      </div>

      {/* ของจริงที่ติดอันดับเอง — แสดงต่อท้ายช่องบูสต์เสมอ แก้ไข/ลากไม่ได้ */}
      {organic.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {organic.map((row) => (
            <div key={row.uuid} className="flex items-center gap-2 rounded-lg border border-border p-2 text-xs">
              <span className="w-3.5 shrink-0" />
              <img
                src={row.cover_image ?? undefined}
                alt={row.title}
                className="h-10 w-7 shrink-0 rounded bg-muted object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground" title={row.title}>
                  {row.title}
                </p>
                <div className="flex flex-wrap gap-x-2 text-[10px] text-muted-foreground">
                  <span>อ่าน/วัน {row.reads_today}</span>
                  <span>รวม {row.total_reads}</span>
                  <span>{row.episode_count} ตอน</span>
                  <span>{row.monthly_earning} เหรียญ/เดือน</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-medium text-teal-700">ยอดจริง</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
