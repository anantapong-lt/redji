'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BookOpenText, Eye, Heart, LibraryBig, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/components/auth/auth-provider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getMyFavoriteStories } from '@/controllers/profile.controller'
import type { FavoriteStoriesResponse, FavoriteStory } from '@/interface/profile.interface'

type StoryType = 'novel' | 'manga'

const compactNumber = new Intl.NumberFormat('th-TH', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

function formatChapterNumber(value: string) {
  return value.replace(/\.0+$/, '')
}

function publishedLabel(value: string) {
  const publishedAt = new Date(value)
  const days = Math.max(0, Math.floor((Date.now() - publishedAt.getTime()) / 86_400_000))
  if (days === 0) return 'วันนี้'
  if (days === 1) return '1 วันที่แล้ว'
  if (days < 30) return `${days.toLocaleString('th-TH')} วันที่แล้ว`
  return publishedAt.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function FavoriteStoryCard({ story }: { story: FavoriteStory }) {
  return (
    <Link
      href={`/content/${encodeURIComponent(story.slug)}`}
      className="group relative overflow-hidden rounded-3xl border border-border/70 bg-card p-3 text-card-foreground shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg sm:p-4"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-primary/14 via-primary/5 to-transparent" />
      <div className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full bg-primary/10 blur-2xl transition duration-500 group-hover:bg-primary/20" />

      <div className="relative flex min-w-0 gap-3 sm:gap-4">
        <div className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-background bg-muted shadow-md sm:w-28">
          {story.cover_url ? (
            <img
              src={story.cover_url}
              alt={`ปกเรื่อง ${story.title}`}
              className="size-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <LibraryBig className="absolute inset-0 m-auto size-9 text-muted-foreground/40" />
          )}
          {story.status === 'completed' && (
            <Badge className="absolute top-2 left-2 h-6 border-0 bg-emerald-600 px-2 text-[11px] text-white shadow-sm hover:bg-emerald-600">จบแล้ว</Badge>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col py-0.5">
          <h2 className="line-clamp-2 min-w-0 text-sm font-extrabold leading-6 transition-colors group-hover:text-primary sm:text-base">
            {story.title}
          </h2>
          <p className="mt-0.5 h-4 truncate text-xs leading-4 text-muted-foreground">โดย {story.author_name}</p>

          <div className="mt-auto flex min-h-14 min-w-0 flex-col justify-center rounded-xl bg-muted/65 px-3 py-2 transition-colors group-hover:bg-primary/8">
            <p className="truncate text-xs font-bold text-foreground sm:text-sm">
              ตอนล่าสุด {formatChapterNumber(story.latest_chapter.chapter_number)} · {story.latest_chapter.title}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {publishedLabel(story.latest_chapter.published_at)}
            </p>
          </div>
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-3 gap-2 text-[11px] text-muted-foreground sm:mt-4 sm:text-xs">
        <span className="flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-muted/60 px-2 py-1.5">
          <BookOpenText className="size-3.5 shrink-0 text-primary" />
          {Number(story.chapter_count).toLocaleString('th-TH')} ตอน
        </span>
        <span className="flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-muted/60 px-2 py-1.5">
          <Eye className="size-3.5 shrink-0 text-primary" />
          {compactNumber.format(Number(story.total_views))}
        </span>
        <span className="flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-muted/60 px-2 py-1.5">
          <Heart className="size-3.5 shrink-0 text-primary" />
          {compactNumber.format(Number(story.favorite_count))}
        </span>
      </div>
    </Link>
  )
}

function StoryCollection({
  result,
  type,
  isLoading,
  onLoadMore,
}: {
  result: FavoriteStoriesResponse
  type: StoryType
  isLoading: boolean
  onLoadMore: () => void
}) {
  if (result.stories.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-16 text-center">
        <LibraryBig className="mx-auto size-11 text-muted-foreground/45" />
        <h2 className="mt-4 font-bold">ยังไม่มี{type === 'novel' ? 'นิยาย' : 'การ์ตูน'}ในชั้นหนังสือ</h2>
        <p className="mt-1 text-sm text-muted-foreground">กดติดตามเรื่องที่ชอบ แล้วรายการจะแสดงที่นี่</p>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {result.stories.map((story) => (
          <FavoriteStoryCard key={story.id} story={story} />
        ))}
      </div>
      {result.pagination.has_next_page && (
        <div className="mt-6 flex justify-center">
          <Button type="button" variant="outline" disabled={isLoading} onClick={onLoadMore} className="min-w-36">
            {isLoading ? (
              <>
                <LoaderCircle className="animate-spin" />
                กำลังโหลด...
              </>
            ) : (
              'ดูเพิ่มเติม'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

export function FavoritesPage({
  initialNovels,
  initialManga,
}: {
  initialNovels: FavoriteStoriesResponse
  initialManga: FavoriteStoriesResponse
}) {
  const { accessToken } = useAuth()
  const [collections, setCollections] = useState<Record<StoryType, FavoriteStoriesResponse>>({
    novel: initialNovels,
    manga: initialManga,
  })
  const [loadingType, setLoadingType] = useState<StoryType | null>(null)

  async function loadMore(type: StoryType) {
    if (!accessToken || loadingType) return
    setLoadingType(type)
    try {
      const current = collections[type]
      const next = await getMyFavoriteStories(type, current.pagination.page + 1, accessToken)
      setCollections((value) => ({
        ...value,
        [type]: { ...next, stories: [...value[type].stories, ...next.stories] },
      }))
    } catch {
      toast.error('ไม่สามารถโหลดรายการเพิ่มเติมได้')
    } finally {
      setLoadingType(null)
    }
  }

  return (
    <main className="mx-auto min-h-[70vh] w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">ชั้นหนังสือส่วนตัว</h1>

      <Tabs defaultValue="novel" className="mt-5 gap-0 sm:mt-7">
        <TabsList className="grid h-12 w-full grid-cols-2 rounded-none border-b border-border bg-transparent p-0 sm:max-w-md">
          <TabsTrigger
            value="novel"
            className="h-12 gap-2 rounded-none border-0 border-b-[3px] border-transparent bg-transparent shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            <BookOpenText className="size-4" />
            นิยาย
          </TabsTrigger>
          <TabsTrigger
            value="manga"
            className="h-12 gap-2 rounded-none border-0 border-b-[3px] border-transparent bg-transparent shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
          >
            <LibraryBig className="size-4" />
            การ์ตูน
          </TabsTrigger>
        </TabsList>

        <TabsContent value="novel" className="mt-5">
          <StoryCollection
            result={collections.novel}
            type="novel"
            isLoading={loadingType === 'novel'}
            onLoadMore={() => void loadMore('novel')}
          />
        </TabsContent>
        <TabsContent value="manga" className="mt-5">
          <StoryCollection
            result={collections.manga}
            type="manga"
            isLoading={loadingType === 'manga'}
            onLoadMore={() => void loadMore('manga')}
          />
        </TabsContent>
      </Tabs>
    </main>
  )
}
