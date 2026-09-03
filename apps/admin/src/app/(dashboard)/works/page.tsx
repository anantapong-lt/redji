'use client'

/**
 * app/(dashboard)/works/page.tsx — "ผลงาน" (2026-08-04, ต่อจริง)
 *
 * Gallery ของผลงานทั้งหมดในระบบ (ไม่ใช่ตาราง) ตามที่ user ขอ: "เรื่องมันเยอะแล้วการใช้งานส่วนมาก
 * ก็เป็นการพิมพ์ชื่อในช่องค้นหาอยู่แล้ว" — hover การ์ดโชว์ชื่อเต็ม, เรียงตามแก้ไขล่าสุด (backend
 * ORDER BY updated_at desc อยู่แล้ว), ค้นหาชื่อ + กรองนักเขียน + กรอง 18+
 *
 * 2026-08-04 แก้: ตัวกรอง "นักเขียน" เดิมเป็น dropdown เลือกจากรายชื่อ — user ขอเปลี่ยนเป็นพิมพ์
 * username/display name ค้นหาแทน (ตัด /admin/work-authors ที่ป้อน dropdown เดิมทิ้งไปแล้ว)
 *
 * กด "เข้าไป" ที่การ์ด → /works/[uuid] (หน้าแก้ไขแบบเดียวกับ writer เป๊ะ + แถบ "โหมด Admin Edit")
 *
 * ล็อก level >= 9 ทั้งหน้า (user ระบุชัดเจนว่าสิทธิ์นี้เฉพาะ level 9 ขึ้นไป — ตรงกับที่ backend
 * เช็คใน admin-works.routes.ts)
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Search, User, BookOpen, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { cn, formatCompactNumber } from '@/lib/utils'
import { useAdminUser } from '@/store/auth.store'
import type { AdminWorkGalleryItem, Pagination } from '@/types'

export default function WorksPage() {
  const me = useAdminUser()
  const myLevel = me?.level ?? 0

  if (myLevel < 9) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-foreground">ผลงาน</h1>
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          ต้องเป็นแอดมินรองขึ้นไป (level ≥ 9) ถึงจะเข้าดูแท็บนี้ได้
        </p>
      </div>
    )
  }

  return <WorksGallery />
}

function WorksGallery() {
  const router = useRouter()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [authorInput, setAuthorInput] = useState('')
  const [author, setAuthor] = useState('')
  const [ageRate, setAgeRate] = useState('')
  // ตัวกรอง "สถานะ" (2026-08-05, user ขอ) — นับแค่ publish_status ('' = ทั้งหมด, '1' = เผยแพร่แล้ว,
  // '0' = ยังไม่เผยแพร่/ซ่อนอยู่) เผื่อในอนาคตอยากได้อะไรที่ทำหน้าที่คล้ายปิดกั้นการมองเห็นเพิ่ม
  const [visibility, setVisibility] = useState('')
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['admin', 'works-gallery', search, author, ageRate, visibility, page],
    queryFn: () => {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '24')
      if (search) params.set('search', search)
      if (author) params.set('author', author)
      if (ageRate) params.set('age_rate', ageRate)
      // "ถูกลบ" เป็นค่าเดียวกับตัวกรอง "สถานะ" แต่จริงๆ ไปกรองคนละคอลัมน์ (works.status ไม่ใช่
      // publish_status) — ฝั่ง UI รวมเป็น dropdown เดียวให้ดูเป็นแนวคิดเดียวกัน (2026-08-10 user ขอ)
      if (visibility === 'deleted') params.set('status', 'deleted')
      else if (visibility) params.set('publish_status', visibility)
      return api.get<{ data: AdminWorkGalleryItem[]; pagination: Pagination }>(`/admin/works?${params.toString()}`)
    },
  })

  const works = query.data?.data ?? []
  const pagination = query.data?.pagination

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">ผลงาน</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          setPage(1)
          setSearch(searchInput.trim())
          setAuthor(authorInput.trim())
        }}
        className="mb-6 flex flex-wrap items-end gap-3"
      >
        <div className="min-w-[240px] flex-1">
          <label className="mb-1.5 block text-sm font-medium text-foreground">ค้นหาชื่อเรื่อง</label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="ชื่อเรื่อง..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="min-w-[220px] flex-1">
          <label className="mb-1.5 block text-sm font-medium text-foreground">นักเขียน</label>
          <div className="relative">
            <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={authorInput}
              onChange={(e) => setAuthorInput(e.target.value)}
              placeholder="username หรือชื่อที่แสดง..."
              className="pl-9"
            />
          </div>
        </div>

        <div className="w-40">
          <label className="mb-1.5 block text-sm font-medium text-foreground">เนื้อหา</label>
          <Select
            value={ageRate}
            onChange={(e) => {
              setPage(1)
              setAgeRate(e.target.value)
            }}
          >
            <option value="">ทั้งหมด</option>
            <option value="all">ทั่วไป</option>
            <option value="18+">18+</option>
          </Select>
        </div>

        <div className="w-44">
          <label className="mb-1.5 block text-sm font-medium text-foreground">สถานะ</label>
          <Select
            value={visibility}
            onChange={(e) => {
              setPage(1)
              setVisibility(e.target.value)
            }}
          >
            <option value="">ทั้งหมด</option>
            <option value="1">เผยแพร่แล้ว</option>
            <option value="0">ยังไม่เผยแพร่ (ซ่อนอยู่)</option>
            <option value="deleted">ถูกลบ (soft delete)</option>
          </Select>
        </div>

        <Button type="submit">ค้นหา</Button>
      </form>

      {query.isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : works.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card py-20">
          <BookOpen className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">ไม่พบผลงานที่ตรงกับเงื่อนไข</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {works.map((w) => (
            <button
              key={w.uuid}
              type="button"
              onClick={() => router.push(`/works/${w.uuid}`)}
              className="group relative aspect-[2/3] cursor-pointer overflow-hidden rounded-xl bg-muted text-left"
            >
              {w.cover_image ? (
                <img
                  src={w.cover_image}
                  alt={w.title}
                  className={cn('size-full object-cover', w.status === 'deleted' && 'grayscale opacity-50')}
                />
              ) : (
                <div className="flex size-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
                  ไม่มีรูปปก
                </div>
              )}

              {/* ถูกลบ (soft delete) — ไอคอนถังขยะมุมขวาบน (2026-08-10 user ขอ) */}
              {w.status === 'deleted' && (
                <div className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-black/70">
                  <Trash2 className="size-3.5 text-white" />
                </div>
              )}

              {/* badge มุมซ้ายบน — สถานะเผยแพร่ + 18+ เห็นได้แม้ไม่ hover เพื่อให้กวาดตาหา
                  "Unreach" (ยังไม่เผยแพร่) ได้เร็วตามที่ user ขอ "ดูได้ทั้งหมดว่าเปิดอันไหนเป็น Unreach" */}
              <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                {w.publish_status === 0 && (
                  <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white">
                    ยังไม่เผยแพร่
                  </span>
                )}
                {w.age_rate === '18+' && (
                  <span className="rounded-full bg-pink-600/90 px-2 py-0.5 text-[10px] font-semibold text-white">18+</span>
                )}
              </div>

              {/* hover overlay — ชื่อเต็ม + นักเขียน (ตามที่ user ขอ "เอาเมาส์ไป Hover แล้วโชว์ชื่อเรื่องเต็มๆ") */}
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/20 to-transparent p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="line-clamp-4 text-xs font-medium text-white">{w.title}</p>
                <p className="mt-1 truncate text-[11px] text-white/70">โดย {w.author.display_name}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <Button variant="outline" className="h-8 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ก่อนหน้า
          </Button>
          <span>
            หน้า {pagination.page} / {pagination.pages} (ทั้งหมด {formatCompactNumber(pagination.total)} เรื่อง)
          </span>
          <Button
            variant="outline"
            className="h-8 text-xs"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            ถัดไป
          </Button>
        </div>
      )}
    </div>
  )
}
