'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Search, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface BookshelfRow {
  uuid: string
  title: string
  cover_image: string | null
  is_featured: boolean
}

// สูงสุด 8 เรื่อง — ต้องตรงกับ MAX_FEATURED_WORKS/MAX_FEATURED_BOOKMARKS ฝั่ง backend และ
// FEATURED_MAX (profile-bookshelf.tsx) แค่ใช้แสดงผล ตัวบังคับจริงอยู่ฝั่ง backend
const FEATURED_MAX = 8
const SEARCH_DEBOUNCE_MS = 400
// จำนวนสูงสุดต่อครั้งที่ดึงมา (ต่อการค้นหา 1 คำ) — 2026-07-29 user ขอเพิ่ม search bar แทนที่จะ
// พึ่งแค่ 50 อันแรกเฉยๆ (ถ้าใครมีเกินนี้จริง ให้พิมพ์ค้นหาแทนเลื่อนหา)
const FETCH_LIMIT = 50

// Dialog เลือกนิยายแนะนำ — 2026-07-29 user ขอย้ายปุ่มปักหมุดออกจากการ์ดในแท็บ "ทั้งหมด"
// (ตรงนั้นควรเป็นแค่ลิสต์อัตโนมัติ ดูอย่างเดียว ไม่ใช่จุดเลือกเพิ่ม) มารวมเป็นปุ่ม "+" เดียว
// มุมขวาบนของแท็บ "แนะนำ" แทน เปิด dialog นี้ให้ติ๊กเลือก/เอาออกได้จากลิสต์เดียว — isWriter
// เลือกว่าลิสต์คือผลงานที่ตัวเองเผยแพร่ (นักเขียน) หรือนิยายที่เก็บเข้าคลังไว้ (นักอ่านทั่วไป)
// อัปเดต 2026-07-29 (รอบสอง): เพิ่ม search bar (ค้นจาก backend จริง ไม่ใช่กรองแค่ 50 อันแรก)
// + เปลี่ยนจากลิสต์แนวตั้งเป็นแถวการ์ดแนวนอน เลื่อนดูเพิ่มได้ (scroll แนวนอน)
export function ManageFeaturedDialog({
  uuid,
  isWriter,
  open,
  onOpenChange,
}: {
  uuid: string
  isWriter: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  // เคลียร์ช่องค้นหาทุกครั้งที่เปิด dialog ใหม่ (ไม่ค้างคำค้นหาจากรอบก่อน)
  useEffect(() => {
    if (open) {
      setSearchInput('')
      setDebouncedSearch('')
    }
  }, [open])

  const basePath = isWriter ? `/users/${uuid}/works` : `/users/${uuid}/bookmarks`
  const togglePath = isWriter ? (novelUuid: string) => `/writer/works/${novelUuid}/featured` : (novelUuid: string) => `/social/bookmarks/${novelUuid}/featured`

  // ⚠️ ไม่ใส่ { public: true } — dialog นี้เปิดได้เฉพาะเจ้าของโปรไฟล์เท่านั้น (ดู ProfileBookshelf)
  // "/bookmarks" ต้องมี token แนบไปด้วยเสมอ ไม่งั้น backend จะคิดว่าเป็นคนอื่นแล้วซ่อนให้ถ้าเจ้าของ
  // ตั้งค่า bookmarks_public ไว้เป็น false (เจอบั๊กนี้มาแล้วครั้งนึง ดู profile-bookshelf.tsx)
  const { data, isLoading } = useQuery({
    queryKey: ['users', uuid, 'bookshelf', 'manage', isWriter, debouncedSearch],
    queryFn: () =>
      api
        .get<{ data: BookshelfRow[] }>(
          `${basePath}?limit=${FETCH_LIMIT}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`,
        )
        .then((res) => res.data),
    enabled: open,
  })

  const novels = data ?? []
  // นับจำนวนที่เลือกไว้จริง — คำนวณจาก override ล่าสุดของแต่ละเรื่องที่เคยกดในเซสชันนี้ ผสมกับ
  // ค่าตั้งต้นจาก server (พอค้นหาเปลี่ยนคำ รายการที่ไม่อยู่ในผลลัพธ์ปัจจุบันจะไม่ถูกนับซ้ำ/หาย
  // เพราะ featuredCount อิงจาก "ที่เห็นตอนนี้" ไม่ครบ 100% แต่พอสำหรับ dialog นี้)
  const featuredCount = novels.filter((n) => overrides[n.uuid] ?? n.is_featured).length

  async function toggle(novelUuid: string, current: boolean) {
    const next = !current
    setOverrides((prev) => ({ ...prev, [novelUuid]: next }))
    try {
      await api.patch(togglePath(novelUuid), { featured: next })
      // invalidate prefix กว้างกว่าเดิม (ตัด 'featured' ต่อท้ายออก) ให้ครอบคีย์ 'manage' ของ dialog
      // นี้เองด้วย — เดิม invalidate แค่ 'featured' (แท็บจริงข้างนอก sync ถูกต้องอยู่แล้ว) แต่ลิสต์
      // ในนี้เอง (คีย์ 'manage') ไม่เคย invalidate เลย พอปิด-เปิด dialog ใหม่ภายใน staleTime จะเห็น
      // checkmark ย้อนกลับเป็นค่าก่อนกดชั่วคราว (Radix Dialog unmount เนื้อหาตอนปิด ทำให้ overrides
      // ที่เก็บไว้ในเครื่องหายไปด้วย ต้องพึ่ง cache จริงตอน remount)
      queryClient.invalidateQueries({ queryKey: ['users', uuid, 'bookshelf'] })
    } catch (err: any) {
      setOverrides((prev) => ({ ...prev, [novelUuid]: current }))
      toast.error(err?.message ?? 'ตั้งนิยายแนะนำไม่สำเร็จ ลองใหม่อีกครั้ง')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            เลือกนิยายแนะนำ ({featuredCount}/{FEATURED_MAX})
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="ค้นหาชื่อเรื่อง..."
            className="h-9 w-full rounded-lg border border-input bg-transparent pr-3 pl-9 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : novels.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {debouncedSearch
              ? `ไม่พบเรื่องที่ตรงกับ "${debouncedSearch}"`
              : isWriter
                ? 'ยังไม่มีผลงานที่เผยแพร่'
                : 'ยังไม่มีนิยายที่เก็บไว้'}
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {novels.map((novel) => {
              const featured = overrides[novel.uuid] ?? novel.is_featured
              return (
                <button
                  key={novel.uuid}
                  type="button"
                  onClick={() => toggle(novel.uuid, featured)}
                  className={cn(
                    'flex w-28 shrink-0 cursor-pointer flex-col gap-1.5 rounded-lg border-2 p-1.5 text-left transition-colors',
                    featured ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted',
                  )}
                >
                  <div className="relative aspect-[2/3] w-full shrink-0 overflow-hidden rounded bg-muted">
                    <Image
                      src={novel.cover_image ?? '/novel-cover-placeholder.png'}
                      alt={novel.title}
                      fill
                      sizes="112px"
                      unoptimized={!novel.cover_image}
                      className="object-cover"
                    />
                    {featured && (
                      <div className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" />
                      </div>
                    )}
                  </div>
                  <span className="line-clamp-2 text-xs font-medium text-foreground">{novel.title}</span>
                </button>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
