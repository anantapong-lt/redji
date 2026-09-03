'use client'

/**
 * components/site/featured-picker-dialog.tsx — เพิ่มนิยายเข้าคิวบูสต์ (2026-08-04, ใหม่)
 *
 * ตามที่ user ขอ: "การเพิ่มก็จะเป็นแถบเหมือนกับในหน้าผลงานที่เห็นเป็น Gallery แต่แทนที่จะเข้าไปแก้
 * มันจะเป็นการดึงมาใส่เลย แล้วก็ตั้งเวลาได้" — เอา gallery pattern จาก
 * apps/admin/src/app/(dashboard)/works/page.tsx มาย่อลง (แค่ค้นหา+เลือก ไม่มีกรองนักเขียน/18+
 * เพราะจุดประสงค์ต่างกัน) กดการ์ดแล้วดึงเข้าคิวบูสต์ทันที ไม่ไปหน้าแก้ไข
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import type { AdminWorkGalleryItem, Pagination } from '@/types'

const SECTION_LABEL: Record<'sales' | 'popular' | 'latest', string> = {
  sales: 'เรื่องเด่นประจำสัปดาห์',
  popular: 'นิยมตลอดกาล',
  latest: 'ใหม่ล่าสุด',
}

export function FeaturedPickerDialog({
  section,
  open,
  onClose,
  onAdded,
}: {
  section: 'sales' | 'popular' | 'latest' | null
  open: boolean
  onClose: () => void
  onAdded: () => void
}) {
  const queryClient = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [durationDays, setDurationDays] = useState('7')
  const [busyUuid, setBusyUuid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'works-gallery-picker', search],
    // published_only=true — บูสต์ได้เฉพาะเรื่องที่เผยแพร่แล้ว (draft ไม่มีวันโผล่หน้าเว็บจริงอยู่ดี
    // เพราะ query สาธารณะกรอง publish_status=1 เสมอ — เจอบั๊กนี้ตอนทดสอบ 2026-08-04)
    queryFn: () =>
      api
        .get<{ data: AdminWorkGalleryItem[]; pagination: Pagination }>(
          `/admin/works?limit=24&published_only=true${search ? `&search=${encodeURIComponent(search)}` : ''}`,
        )
        .then((res) => res.data),
    enabled: open,
  })

  async function handlePick(uuid: string) {
    if (!section) return
    setError(null)
    setBusyUuid(uuid)
    try {
      await api.post('/admin/featured-works', {
        work_uuid: uuid,
        section,
        duration_days: Number(durationDays) || 7,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'featured-preview'] })
      onAdded()
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'เพิ่มไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setBusyUuid(null)
    }
  }

  return (
    <Modal
      open={open && section !== null}
      onClose={onClose}
      size="lg"
      title={section ? `เพิ่มนิยายแนะนำ — ${SECTION_LABEL[section]}` : ''}
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1.5 block text-sm font-medium text-foreground">ค้นหาชื่อเรื่อง</label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setSearch(searchInput.trim())
                }}
                placeholder="ชื่อเรื่อง..."
                className="pl-9"
              />
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => setSearch(searchInput.trim())}>
            ค้นหา
          </Button>
          <div className="w-32">
            <label className="mb-1.5 block text-sm font-medium text-foreground">อยู่กี่วัน</label>
            <Input type="number" min={1} max={90} value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
          </div>
        </div>

        {query.isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : (query.data ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">ไม่พบผลงานที่ตรงกับเงื่อนไข</p>
        ) : (
          <div className="grid max-h-[50vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
            {(query.data ?? []).map((w) => (
              <button
                key={w.uuid}
                type="button"
                disabled={busyUuid === w.uuid}
                onClick={() => handlePick(w.uuid)}
                className="group relative aspect-[2/3] cursor-pointer overflow-hidden rounded-lg bg-muted text-left disabled:opacity-50"
              >
                {w.cover_image ? (
                  <img src={w.cover_image} alt={w.title} className="size-full object-cover" />
                ) : (
                  <div className="flex size-full items-center justify-center p-2 text-center text-[10px] text-muted-foreground">
                    ไม่มีรูปปก
                  </div>
                )}
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/10 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <p className="line-clamp-3 text-[11px] font-medium text-white">{w.title}</p>
                  <p className="truncate text-[10px] text-white/70">โดย {w.author.display_name}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
