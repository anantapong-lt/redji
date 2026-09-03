'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { NovelCard } from '@/components/home/novel-card'
import { NovelCardSkeleton } from '@/components/loading/public-page-skeletons'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useContentPreferenceStore, contentPreferenceToParams } from '@/store/content-preference.store'
import type { NovelCardData } from '@/types'

const RESULTS_PER_PAGE = 24

const COLLECTIONS = {
  popular: {
    title: 'นิยมตลอดกาล',
    description: 'นิยายที่นักอ่านเข้าชมมากที่สุดตลอดกาล',
    sort: 'popular',
  },
  latest: {
    title: 'ใหม่ล่าสุด',
    description: 'นิยายที่เพิ่งเข้ามาใหม่ใน Readji',
    sort: 'latest',
  },
} as const

type GalleryCollection = keyof typeof COLLECTIONS

interface ApiGalleryRow {
  uuid: string
  title: string
  cover_image: string | null
  view_count: string | null
  episode_count: number
  like_count: number
  extra_category_count: number
  age_rate: 'all' | '18+' | null
  tags: string[]
  author: { display_name: string }
  category_main: { id: string; name: string } | null
  category_sub: { id: string; name: string } | null
}

interface ApiGalleryResponse {
  data: ApiGalleryRow[]
  pagination: { page: number; total_pages: number }
}

function mapWorkToCard(row: ApiGalleryRow): NovelCardData {
  return {
    uuid: row.uuid,
    title: row.title,
    cover_image: row.cover_image,
    author_name: row.author.display_name,
    age_rate: row.age_rate ?? 'all',
    tags: row.tags,
    category_main: row.category_main ? { id: Number(row.category_main.id), name: row.category_main.name } : null,
    category_sub: row.category_sub ? { id: Number(row.category_sub.id), name: row.category_sub.name } : null,
    extra_category_count: row.extra_category_count,
    episode_count: row.episode_count,
    view_count: Number(row.view_count ?? 0),
    like_count: row.like_count,
  }
}

function GalleryPageContent() {
  const searchParams = useSearchParams()
  const collectionParam = searchParams.get('collection')
  const collection: GalleryCollection = collectionParam === 'latest' ? 'latest' : 'popular'
  const config = COLLECTIONS[collection]
  const [page, setPage] = useState(1)

  // เมนู "การแสดงผลเนื้อหา" (ไอคอนหัวใจ navbar) — 18+/BL/GL มีผลกับหน้านี้ด้วยตามที่ user ขอ
  const { age18, bl, gl } = useContentPreferenceStore()
  const contentPref = contentPreferenceToParams({ age18, bl, gl })

  useEffect(() => {
    setPage(1)
  }, [collection])

  const { data, isError, isLoading } = useQuery({
    queryKey: ['works', 'gallery', collection, page, contentPref],
    queryFn: () => {
      const params = new URLSearchParams({
        sort: config.sort,
        sort_dir: 'desc',
        page: String(page),
        limit: String(RESULTS_PER_PAGE),
      })
      if (contentPref.age_rate) params.set('age_rate', contentPref.age_rate)
      if (contentPref.tags_all) params.set('tags_all', contentPref.tags_all.join(','))
      if (contentPref.tags_none) params.set('tags_none', contentPref.tags_none.join(','))
      return api.get<ApiGalleryResponse>('/works?' + params.toString())
    },
  })

  const novels = (data?.data ?? []).map(mapWorkToCard)
  const totalPages = data?.pagination.total_pages ?? 1

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-7 sm:px-6 md:px-8 md:py-10">
      <div className="mb-7 flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-[11px] font-bold tracking-[0.16em] text-primary">DISCOVER STORIES</p>
          <h1 className="readji-page-title text-2xl sm:text-3xl">{config.title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{config.description}</p>
        </div>

        <div
          role="tablist"
          aria-label="เลือกคอลเลกชันนิยาย"
          className="grid w-full grid-cols-2 rounded-xl border border-[#d8cbb3] bg-[#e9deca] p-1 sm:w-[300px]"
        >
          {(Object.keys(COLLECTIONS) as GalleryCollection[]).map((key) => (
            <Link
              key={key}
              href={'/gallery?collection=' + key}
              role="tab"
              aria-selected={collection === key}
              className={cn(
                'rounded-lg px-3 py-2 text-center text-sm font-semibold transition-all',
                collection === key
                  ? 'bg-primary text-primary-foreground shadow-[0_3px_8px_rgb(71_31_33_/_0.2)]'
                  : 'text-primary hover:bg-white/45',
              )}
            >
              {COLLECTIONS[key].title}
            </Link>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(186px,1fr))] justify-items-center gap-x-5 gap-y-7">
          {Array.from({ length: 12 }, (_, index) => (
            <NovelCardSkeleton key={index} />
          ))}
        </div>
      ) : isError ? (
        <p className="py-20 text-center text-sm text-destructive">โหลดนิยายไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>
      ) : novels.length === 0 ? (
        <p className="py-20 text-center text-sm text-muted-foreground">ยังไม่มีนิยายในคอลเลกชันนี้</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(186px,1fr))] justify-items-center gap-x-5 gap-y-7">
          {novels.map((novel) => (
            <NovelCard key={novel.uuid} novel={novel} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-4" aria-label="เปลี่ยนหน้าคอลเลกชัน">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
            aria-label="หน้าก่อนหน้า"
            className="flex size-9 cursor-pointer items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
            aria-label="หน้าถัดไป"
            className="flex size-9 cursor-pointer items-center justify-center rounded-xl border border-border bg-card transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </nav>
      )}
    </main>
  )
}

export default function GalleryPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 md:px-8">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(186px,1fr))] justify-items-center gap-x-5 gap-y-7">
            {Array.from({ length: 12 }, (_, index) => (
              <NovelCardSkeleton key={index} />
            ))}
          </div>
        </main>
      }
    >
      <GalleryPageContent />
    </Suspense>
  )
}
