'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Eye, EyeOff } from 'lucide-react'
import { NovelCard } from '@/components/home/novel-card'
import { NovelCardSkeleton } from '@/components/loading/public-page-skeletons'
import { ProfileEmptyState } from './profile-empty-state'
import { ManageFeaturedDialog } from './manage-featured-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { NovelCardData, ProfileData } from '@/types'

interface ApiBookshelfRow {
  uuid: string
  title: string
  cover_image: string | null
  author_name: string
  age_rate: 'all' | '18+' | null
  tags: string[]
  category_main: { id: string; name: string } | null
  category_sub: { id: string; name: string } | null
  extra_category_count: number
  episode_count: number
  view_count: string
  like_count: number
  is_featured: boolean
}

interface ApiBookshelfResponse {
  data: ApiBookshelfRow[]
  pagination: { page: number; limit: number; total: number; pages: number }
  hidden?: boolean // เฉพาะ /bookmarks (นักอ่านทั่วไป) — true เมื่อเจ้าของซ่อนไว้จากคนอื่น
}

function mapRow(row: ApiBookshelfRow): NovelCardData {
  return {
    ...row,
    age_rate: row.age_rate ?? 'all',
    category_main: row.category_main ? { id: Number(row.category_main.id), name: row.category_main.name } : null,
    category_sub: row.category_sub ? { id: Number(row.category_sub.id), name: row.category_sub.name } : null,
    view_count: Number(row.view_count),
  }
}

const ALL_PAGE_SIZE = 12
// สูงสุด 8 เรื่องในแท็บ "แนะนำ" (ต้องตรงกับ MAX_FEATURED_WORKS/MAX_FEATURED_BOOKMARKS ฝั่ง
// backend — เดาไว้ที่พอดีกับ ~4 การ์ดต่อแถว x 2 แถวบนจอ desktop ทั่วไป ตามที่ user ขอ)
const FEATURED_MAX = 8

const TABS = [
  { key: 'featured', label: 'แนะนำ' },
  { key: 'all', label: 'ทั้งหมด' },
] as const
type TabKey = (typeof TABS)[number]['key']

type SortKey = 'latest' | 'popular'
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'latest', label: 'ล่าสุด' },
  { key: 'popular', label: 'ยอดดูมากที่สุด' },
]

// กล่องผลงานหน้าโปรไฟล์ — นักเขียน (isWriter) โชว์ผลงานที่เผยแพร่เอง (/users/:uuid/works)
// นักอ่านทั่วไปโชว์บุ๊คมาร์คแทน (/users/:uuid/bookmarks) เพราะไม่มีผลงานให้โชว์ (2026-07-29
// มติแก้รอบ 3 — user ขอให้นักอ่านทั่วไปใช้บุ๊คมาร์ค พร้อม toggle ซ่อนจากคนอื่นได้ default โชว์)
// ทั้งสองฝั่งใช้ UI เดียวกันทั้งหมด: "แนะนำ" (เจ้าของเลือกเองได้ สูงสุด 8 เรื่อง ผ่านปุ่ม "+")
// กับ "ทั้งหมด" (infinite scroll, อัตโนมัติ ดูอย่างเดียว การ์ดตัดหมวดหมู่/ชื่อนักเขียนออก)
export function ProfileBookshelf({
  uuid,
  isOwnProfile,
  isWriter,
  initialBookmarksPublic,
}: {
  uuid: string
  isOwnProfile: boolean
  isWriter: boolean
  initialBookmarksPublic: boolean
}) {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabKey>('featured')
  const [manageOpen, setManageOpen] = useState(false)
  const [bookmarksPublic, setBookmarksPublic] = useState(initialBookmarksPublic)
  const [sort, setSort] = useState<SortKey>('latest')

  const basePath = isWriter ? `/users/${uuid}/works` : `/users/${uuid}/bookmarks`

  // ⚠️ ไม่ใส่ { public: true } ตรงนี้ — เพราะ apiFetch จะไม่แนบ Authorization header เลยถ้า
  // public: true (ดู lib/api.ts) ทั้งที่ "/bookmarks" เป็น optional-auth (เจ้าของต้องเห็นของ
  // ตัวเองเสมอแม้ตั้งซ่อนจากคนอื่นไว้ — ต้องมี token แนบไปให้ backend รู้ว่า viewer คือใคร)
  // เจอบั๊กเดียวกันนี้มาแล้วครั้งนึงตอนแก้ is_following (/profile/[uuid]/page.tsx) — ไม่มีผลกับ
  // guest เพราะ token เป็น null อยู่แล้ว จะไม่แนบ header เหมือนเดิม
  const { data: featuredData, isLoading: featuredLoading } = useQuery({
    queryKey: ['users', uuid, 'bookshelf', 'featured', isWriter],
    queryFn: () => api.get<ApiBookshelfResponse>(`${basePath}?featured=true&limit=${FEATURED_MAX}`),
  })

  const {
    data: allData,
    isLoading: allLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['users', uuid, 'bookshelf', 'all', isWriter, sort],
    queryFn: ({ pageParam }) =>
      api.get<ApiBookshelfResponse>(`${basePath}?page=${pageParam}&limit=${ALL_PAGE_SIZE}&sort=${sort}`),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.pages ? lastPage.pagination.page + 1 : undefined,
    enabled: tab === 'all',
  })

  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || tab !== 'all') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
      },
      { rootMargin: '200px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [tab, hasNextPage, isFetchingNextPage, fetchNextPage])

  // sync กลับเข้า cache ของหน้าโปรไฟล์ — component นี้ mount ได้ทั้ง /profile (คีย์ ['users','me',
  // 'profile']) และ /profile/[uuid] (คีย์ ['users', uuid, 'profile'], uuid จริง) แต่ไม่รู้ว่าตอนนี้
  // อยู่หน้าไหน (ไม่มี prop บอก) เลย patch ทั้ง 2 คีย์ไปเลย (คีย์ที่ไม่ได้ cache อยู่จริงจะเป็น no-op
  // เฉยๆ) เดิม toggle นี้อัปเดตแค่ useState ไม่เคยแตะ cache เลย พอสลับหน้าไปมาแล้วกลับมาภายใน
  // staleTime จะเห็นค่าเก่าย้อนกลับมา ทั้งที่ backend บันทึกถูกต้องแล้ว
  function patchProfileCache(next: boolean) {
    queryClient.setQueryData<ProfileData>(['users', uuid, 'profile'], (old) => (old ? { ...old, bookmarks_public: next } : old))
    queryClient.setQueryData<ProfileData>(['users', 'me', 'profile'], (old) => (old ? { ...old, bookmarks_public: next } : old))
  }

  // ซ่อน/แสดงบุ๊คมาร์คจากคนอื่น (นักอ่านทั่วไปเท่านั้น) — เจ้าของเห็นของตัวเองเสมอไม่ว่าตั้งค่า
  // ไว้ยังไง (ฝั่ง backend คุมตรงนี้อยู่แล้ว) ปุ่มนี้แค่คุมว่า "คนอื่น" จะเห็นไหม
  async function toggleBookmarksPublic() {
    const next = !bookmarksPublic
    setBookmarksPublic(next)
    patchProfileCache(next)
    try {
      await api.patch('/users/me', { bookmarks_public: next })
      toast.success(next ? 'แสดงรายการที่เก็บไว้ให้คนอื่นเห็นแล้ว' : 'ซ่อนรายการที่เก็บไว้จากคนอื่นแล้ว')
    } catch (err: any) {
      setBookmarksPublic(!next)
      patchProfileCache(!next)
      toast.error(err?.message ?? 'ตั้งค่าไม่สำเร็จ ลองใหม่อีกครั้ง')
    }
  }

  const isHidden = !isOwnProfile && (Boolean(featuredData?.hidden) || Boolean(allData?.pages?.[0]?.hidden))
  const featuredNovels = (featuredData?.data ?? []).map(mapRow)
  const allNovels = (allData?.pages ?? []).flatMap((p) => p.data).map(mapRow)

  return (
    <div className="flex flex-col gap-4 rounded-[25px] bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              tab === t.key
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {t.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {isOwnProfile && tab === 'featured' && (
            <button
              type="button"
              onClick={() => setManageOpen(true)}
              className="flex cursor-pointer items-center gap-1 rounded-full border border-[#d9d9d9] px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <Plus className="size-3.5" />
              เพิ่มนิยายแนะนำ
            </button>
          )}

          {/* เรียงลำดับแท็บ "ทั้งหมด" — เรียงตามตัวนิยายเองเสมอ (created_at/view_count) ไม่ใช่
              เวลาที่เก็บเข้าคลัง (2026-07-29 user ขอ) — ใส่ sort ไว้ใน queryKey ของ
              useInfiniteQuery แล้ว เปลี่ยนค่านี้จะรีเซ็ต pagination กลับไปหน้า 1 อัตโนมัติ */}
          {tab === 'all' && (
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger size="sm" className="h-8 w-[150px] cursor-pointer text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {isOwnProfile && !isWriter && (
            <button
              type="button"
              onClick={toggleBookmarksPublic}
              aria-label={bookmarksPublic ? 'ซ่อนรายการที่เก็บไว้จากคนอื่น' : 'แสดงรายการที่เก็บไว้ให้คนอื่นเห็น'}
              title={bookmarksPublic ? 'คนอื่นเห็นได้อยู่ — กดเพื่อซ่อน' : 'ซ่อนจากคนอื่นอยู่ — กดเพื่อแสดง'}
              className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-[#d9d9d9] text-muted-foreground transition-colors hover:bg-muted"
            >
              {bookmarksPublic ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </button>
          )}
        </div>
      </div>

      {isHidden ? (
        <p className="py-10 text-center text-sm text-muted-foreground">ผู้ใช้นี้ซ่อนรายการที่เก็บไว้ไว้</p>
      ) : tab === 'featured' ? (
        featuredLoading ? (
          <div className="flex flex-wrap gap-4">
            {Array.from({ length: 4 }, (_, index) => (
              <NovelCardSkeleton key={index} />
            ))}
          </div>
        ) : featuredNovels.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {isOwnProfile ? 'ยังไม่ได้ตั้งนิยายแนะนำ — กดปุ่ม "เพิ่มนิยายแนะนำ" ด้านบนเพื่อเลือกได้' : 'ยังไม่มีนิยายแนะนำ'}
          </p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {featuredNovels.map((novel) => (
              <NovelCard key={novel.uuid} novel={novel} />
            ))}
          </div>
        )
      ) : allLoading ? (
        <div className="flex flex-wrap gap-4">
          {Array.from({ length: 4 }, (_, index) => (
            <NovelCardSkeleton key={index} />
          ))}
        </div>
      ) : allNovels.length === 0 ? (
        isOwnProfile ? (
          <ProfileEmptyState variant={isWriter ? 'writer' : 'reader'} />
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {isWriter ? 'ยังไม่มีผลงานที่เผยแพร่' : 'ยังไม่มีนิยายที่เก็บไว้'}
          </p>
        )
      ) : (
        <>
          <div className="flex flex-wrap gap-4">
            {allNovels.map((novel) => (
              <NovelCard key={novel.uuid} novel={novel} compact />
            ))}
          </div>
          <div ref={sentinelRef} className="h-1" />
          {isFetchingNextPage && (
            <div className="flex gap-4 pt-4">
              {Array.from({ length: 2 }, (_, index) => (
                <NovelCardSkeleton key={index} />
              ))}
            </div>
          )}
        </>
      )}

      {isOwnProfile && (
        <ManageFeaturedDialog uuid={uuid} isWriter={isWriter} open={manageOpen} onOpenChange={setManageOpen} />
      )}
    </div>
  )
}
