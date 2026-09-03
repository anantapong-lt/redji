'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Search, X, ChevronLeft, ChevronRight, IdCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { WorksTable, type WriterWorkRow } from '@/components/writer/works-table'
import type { AgeRate } from '@/types'
import { useUser } from '@/store/auth.store'

// รูปทรงตรงกับที่ GET /writer/works ส่งจริง — category ids เป็น string (bigint แปลงมา)
// ต้องแปลงเป็น number ตอน map ให้ตรงกับ CategoryRef ฝั่ง frontend
interface ApiWorkRow {
  uuid: string
  title: string
  cover_image: string | null
  age_rate: AgeRate
  tags: string[]
  publish_status: 0 | 1
  sales: number
  category_main: { id: string; name: string } | null
  category_sub: { id: string; name: string } | null
  extra_category_count: number
}

function mapToRow(w: ApiWorkRow): WriterWorkRow {
  return {
    uuid: w.uuid,
    title: w.title,
    cover_image: w.cover_image,
    category_main: w.category_main ? { id: Number(w.category_main.id), name: w.category_main.name } : null,
    category_sub: w.category_sub ? { id: Number(w.category_sub.id), name: w.category_sub.name } : null,
    extra_category_count: w.extra_category_count,
    tags: w.tags,
    sales: w.sales,
    age_rate: w.age_rate,
    publish_status: w.publish_status,
  }
}

export default function WriterWorksPage() {
  const [search, setSearch] = useState('')
  const user = useUser()
  const isWriter = (user?.level ?? 0) >= 6

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['writer', 'works'],
    queryFn: () => api.get<{ data: ApiWorkRow[] }>('/writer/works'),
    enabled: isWriter,
  })

  const works = (data?.data ?? []).map(mapToRow)
  const filtered = works.filter((w) =>
    w.title.toLowerCase().includes(search.toLowerCase()),
  )

  // ยังไม่ผ่านอนุมัติเป็นนักเขียน (level < 6) — ไม่ยิง query ไปเลย (backend เช็คซ้ำอยู่แล้วก็จริง
  // แต่ไม่มีประโยชน์จะยิงไปให้โดน reject) — มาถึงจุดนี้ได้แปลว่าส่งฟอร์ม "ข้อมูลนักเขียน" ไปแล้ว
  // เสมอ (ไม่งั้นโดน (writer)/layout.tsx เด้งไป /writer/info ก่อนแล้ว) เลยโชว่าข้อความรอตรวจสอบ
  // แทนที่จะชวนไปกรอกข้อมูลซ้ำ
  if (!isWriter) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <IdCard className="size-10 text-muted-foreground" />
        <div>
          <h1 className="mb-2 text-xl font-bold text-foreground">ยังไม่มีสิทธิ์เข้าหน้านี้</h1>
          <p className="text-sm text-muted-foreground">
            คำขอเป็นนักเขียนของคุณอยู่ระหว่างรอการตรวจสอบ ทีมงานจะติดต่อกลับเมื่อได้รับการอนุมัติ
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-lg">
          <Link href="/writer/info">ดูข้อมูลที่ส่งไป</Link>
        </Button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">นิยาย</h1>

      <label className="mb-1.5 block text-sm font-medium text-foreground">ค้นหา</label>
      <div className="relative mb-4">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อเรื่อง..."
          className="h-10 w-full rounded-lg border border-input bg-transparent pr-9 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="ล้างการค้นหา"
            className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="mb-4 flex items-center justify-between">
        <Button asChild className="rounded-full bg-teal-500 text-white hover:bg-teal-600">
          <Link href="/writer/works/new">เพิ่มนิยายใหม่+</Link>
        </Button>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <button
            type="button"
            disabled
            aria-label="หน้าก่อนหน้า"
            className="flex size-7 items-center justify-center rounded-md border border-border disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span>1 / 1</span>
          <button
            type="button"
            disabled
            aria-label="หน้าถัดไป"
            className="flex size-7 items-center justify-center rounded-md border border-border disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : isError ? (
        <p className="py-8 text-center text-sm text-destructive">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {search ? 'ไม่พบนิยายที่ค้นหา' : 'ยังไม่มีนิยาย — กด "เพิ่มนิยายใหม่+" เพื่อเริ่มต้น'}
        </p>
      ) : (
        <WorksTable works={filtered} onDeleted={() => refetch()} />
      )}
    </div>
  )
}
