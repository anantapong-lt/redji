'use client'

/**
 * app/(main)/history/page.tsx — หน้าประวัติการอ่าน (login only)
 *
 * แบ่ง 3 กลุ่มตามความล่าสุดของครั้งที่อ่านล่าสุด: ล่าสุด (ภายใน 1 วัน) / สัปดาห์นี้
 * (เกิน 1 วันถึง 7 วัน) / นานกว่านั้น (เกิน 7 วัน) — pagination ใช้กับกลุ่ม "นานกว่านั้น"
 * เท่านั้นตามที่ user ขอ อีก 2 กลุ่มโชว์ครบไม่ตัดหน้า
 *
 * การ์ดใช้ SearchResultCard ตัวเดียวกับหน้า /search (เพิ่งทำจาก Figma มาสดๆ) — reuse
 * component เดิม ไม่สร้างใหม่ซ้ำ — updated_at ที่การ์ดโชว์ตรงมุมขวาล่าง ในหน้านี้ใช้
 * last_read_at แทน (เวลาที่อ่านล่าสุด สมเหตุสมผลกว่าเวลาที่เรื่องอัปเดตล่าสุดสำหรับหน้าประวัติ)
 */

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SearchResultCard } from '@/components/search/search-result-card'
import { SearchResultCardSkeleton } from '@/components/loading/public-page-skeletons'
import { api } from '@/lib/api'
import type { SearchResultData } from '@/types'

const OLDER_PAGE_SIZE = 20

interface ApiHistoryRow {
  uuid: string
  title: string
  description: string | null
  cover_image: string | null
  tags: string[]
  view_count: string
  like_count: number
  comment_count: number
  author: { display_name: string }
  category_main: { id: string; name: string } | null
  category_sub: { id: string; name: string } | null
  last_read_at: string
}

interface ApiHistoryResponse {
  recent: ApiHistoryRow[]
  this_week: ApiHistoryRow[]
  older: ApiHistoryRow[]
  older_pagination: { page: number; limit: number; total: number; pages: number }
}

function mapRow(row: ApiHistoryRow): SearchResultData {
  return {
    uuid: row.uuid,
    title: row.title,
    description: row.description,
    cover_image: row.cover_image,
    author_name: row.author.display_name,
    category_main: row.category_main ? { id: Number(row.category_main.id), name: row.category_main.name } : null,
    category_sub: row.category_sub ? { id: Number(row.category_sub.id), name: row.category_sub.name } : null,
    tags: row.tags,
    view_count: Number(row.view_count ?? 0),
    like_count: row.like_count,
    comment_count: row.comment_count,
    updated_at: row.last_read_at, // การ์ดนี้โชว์เป็น "เวลาที่อ่านล่าสุด" ไม่ใช่เวลาที่เรื่องอัปเดต
  }
}

function HistorySection({ title, novels }: { title: string; novels: SearchResultData[] }) {
  if (novels.length === 0) return null
  return (
    <div className="mb-8">
      <h2 className="mb-4 text-xl font-bold text-primary">{title}</h2>
      <div className="flex flex-col gap-4">
        {novels.map((novel) => (
          <SearchResultCard key={novel.uuid} novel={novel} />
        ))}
      </div>
    </div>
  )
}

export default function HistoryPage() {
  const [olderPage, setOlderPage] = useState(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['reading-history', olderPage],
    queryFn: () =>
      api.get<ApiHistoryResponse>(`/social/reading-history?page=${olderPage}&limit=${OLDER_PAGE_SIZE}`),
  })

  // เปลี่ยนหน้า "นานกว่านั้น" แล้ว scroll ขึ้นไปดูส่วนนั้นให้เห็นผลทันที
  useEffect(() => {
    if (olderPage > 1) {
      document.getElementById('history-older-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [olderPage])

  const recent = (data?.recent ?? []).map(mapRow)
  const thisWeek = (data?.this_week ?? []).map(mapRow)
  const older = (data?.older ?? []).map(mapRow)
  const olderTotalPages = data?.older_pagination.pages ?? 1
  const isEmpty = !isLoading && recent.length === 0 && thisWeek.length === 0 && older.length === 0

  return (
    <div className="mx-auto max-w-[1280px] px-8 py-10">
      <h1 className="mb-6 text-[32px] font-bold text-primary">ประวัติการอ่าน</h1>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, index) => (
            <SearchResultCardSkeleton key={index} />
          ))}
        </div>
      ) : isError ? (
        <p className="py-16 text-center text-sm text-destructive">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>
      ) : isEmpty ? (
        <p className="py-16 text-center text-sm text-muted-foreground">ยังไม่มีประวัติการอ่าน ลองไปอ่านนิยายสักเรื่องดูสิ</p>
      ) : (
        <>
          <HistorySection title="ล่าสุด" novels={recent} />
          <HistorySection title="สัปดาห์นี้" novels={thisWeek} />

          {older.length > 0 && (
            <div id="history-older-section">
              <HistorySection title="นานกว่านั้น" novels={older} />

              {olderTotalPages > 1 && (
                <div className="mt-2 flex items-center justify-center gap-4">
                  <button
                    type="button"
                    disabled={olderPage <= 1}
                    onClick={() => setOlderPage((p) => p - 1)}
                    aria-label="หน้าก่อนหน้า"
                    className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-border disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <span className="text-sm text-muted-foreground">
                    {olderPage} / {olderTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={olderPage >= olderTotalPages}
                    onClick={() => setOlderPage((p) => p + 1)}
                    aria-label="หน้าถัดไป"
                    className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-border disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
