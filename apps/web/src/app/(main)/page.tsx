'use client'

/**
 * app/(main)/page.tsx — หน้าแรก (/)
 *
 * ดึงข้อมูลจริงจาก GET /works (ดู works.service.ts) — ไม่ mock แล้ว
 *
 * 2026-08-04: 3 แถวหลัก ("เรื่องเด่นประจำสัปดาห์"/"นิยมตลอดกาล"/"ใหม่ล่าสุด") เปลี่ยนจาก
 * GET /works?sort=X ตรงๆ มาเป็น GET /works/home-section?section=X แทน — เพราะตอนนี้มีระบบ
 * "นิยายแนะนำ" ที่แอดมินเลือกผลงานมาบูสต์ให้ไปปนอยู่ในแถวเหล่านี้ได้แล้ว (ดู
 * apps/admin ตั้งหน้าเว็บไซต์ > นิยายแนะนำ, backend getHomeSection() ใน works.service.ts)
 * ไม่แก้ GET /works ตรงๆ เพราะ endpoint นั้นใช้ร่วมกับหน้า /search ด้วย (การบูสต์ควรมีผลแค่
 * หน้าแรกเท่านั้น ไม่ใช่ทุกหน้าที่เรียก sort เดียวกัน) — ranking board ด้านล่าง (ยอดวิว/ใจ/
 * ยอดขาย) ยังใช้ GET /works ปกติเหมือนเดิม (เป็นการจัดอันดับล้วนๆ ตามที่ตกลงกันไว้ ไม่ปนของบูสต์)
 *
 * หมายเหตุการตีความเดิม: "เรื่องเด่นประจำสัปดาห์" ใช้ sort=sales (วัดจากยอดขายจริง ไม่ใช่ยอดใจ
 * เพื่อดันเรื่องที่ทำเงินให้เว็บขึ้นมาเด่น — 2026-07-30)
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { AnnouncementBar } from '@/components/home/announcement-bar'
import { CategoryRow } from '@/components/home/category-row'
import { HeroCarousel, type HeroSlide } from '@/components/home/hero-carousel'
import { NovelSection } from '@/components/home/novel-section'
import { RankingBoard } from '@/components/home/ranking-board'
import { HeroCarouselSkeleton, HomeSectionSkeleton, RankingBoardSkeleton } from '@/components/loading/public-page-skeletons'
import { api } from '@/lib/api'
import { useContentPreferenceStore, contentPreferenceToParams } from '@/store/content-preference.store'
import type { NovelCardData, RankingEntry } from '@/types'

// รูปทรงตรงกับ response จริงของ GET /carousels (ดู works.service.ts getCarousels)
interface ApiCarouselRow {
  id: string
  title: string | null
  subtitle: string | null
  image_path: string
  link_url: string | null
  display_seconds: number
}

// รูปทรงตรงกับ response จริงของ GET /works (ดู works.service.ts getWorks)
interface ApiWorkListRow {
  uuid: string
  title: string
  cover_image: string | null
  view_count: string | null
  episode_count: number
  like_count: number
  comment_count: number
  extra_category_count: number
  age_rate: 'all' | '18+' | null
  tags: string[]
  author: { uuid: string; display_name: string; user_img: string | null }
  category_main: { id: string; name: string } | null
  category_sub: { id: string; name: string } | null
}

function mapWorkToCard(row: ApiWorkListRow): NovelCardData {
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

function mapWorksToRanking(rows: ApiWorkListRow[]): RankingEntry[] {
  return rows.map((row, i) => ({ ...mapWorkToCard(row), rank: i + 1 }))
}

// เมนู "การแสดงผลเนื้อหา" (ไอคอนหัวใจ navbar) — ต่อ query string จาก contentPreferenceToParams()
// ใช้ร่วมกันทั้ง ranking board (useWorksQuery) และ 3 แถวหลัก (useHomeSectionQuery) ด้านล่าง
function contentPrefToQueryString(pref: ReturnType<typeof contentPreferenceToParams>): string {
  const params = new URLSearchParams()
  if (pref.age_rate) params.set('age_rate', pref.age_rate)
  if (pref.tags_all) params.set('tags_all', pref.tags_all.join(','))
  if (pref.tags_none) params.set('tags_none', pref.tags_none.join(','))
  const s = params.toString()
  return s ? '&' + s : ''
}

function useWorksQuery(
  sort: 'latest' | 'popular' | 'likes' | 'comments' | 'sales',
  limit: number,
  contentPref: ReturnType<typeof contentPreferenceToParams>,
  dateRange?: 'week',
) {
  return useQuery({
    queryKey: ['works', sort, limit, dateRange, contentPref],
    queryFn: () => {
      const dateRangeQuery = dateRange ? '&date_range=' + dateRange : ''
      return api
        .get<{ data: ApiWorkListRow[] }>('/works?sort=' + sort + '&limit=' + limit + dateRangeQuery + contentPrefToQueryString(contentPref))
        .then((res) => res.data)
    },
  })
}

// 2026-08-04 — 3 แถวหลักของหน้าแรกเท่านั้น (ไม่ใช่ ranking board) ผสม "นิยายแนะนำ" ที่บูสต์ไว้
// เข้ากับของจริงแล้วฝั่ง backend (getHomeSection()) — หน้าตา response เหมือน GET /works ทุกอย่าง
// แค่คนละ endpoint กัน ไม่กระทบ /search
function useHomeSectionQuery(
  section: 'sales' | 'popular' | 'latest',
  limit: number,
  contentPref: ReturnType<typeof contentPreferenceToParams>,
) {
  return useQuery({
    queryKey: ['works', 'home-section', section, limit, contentPref],
    queryFn: () =>
      api
        .get<{ data: ApiWorkListRow[] }>(`/works/home-section?section=${section}&limit=${limit}${contentPrefToQueryString(contentPref)}`)
        .then((res) => res.data),
  })
}

// การ์ดในแต่ละแถวมี 3 สถานะ (โหลด/error/ว่าง) ก่อนจะถึงข้อมูลจริง — โชว์ header เดิม
// ไว้เสมอเพื่อไม่ให้หน้าดูกระโดด แค่สลับเนื้อหาด้านล่าง
function HomeSection({
  title,
  href,
  query,
}: {
  title: string
  href: string
  query: UseQueryResult<ApiWorkListRow[]>
}) {
  if (query.isLoading) {
    return <HomeSectionSkeleton title={title} />
  }

  if (query.isError) {
    return (
      <section className="mx-auto mt-10 max-w-[1280px] px-4 md:px-8">
        <h2 className="mb-4 text-lg font-bold text-foreground md:text-xl">{title}</h2>
        <p className="py-6 text-center text-sm text-destructive">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>
      </section>
    )
  }

  const novels = (query.data ?? []).map(mapWorkToCard)

  if (novels.length === 0) {
    return (
      <section className="mx-auto mt-10 max-w-[1280px] px-4 md:px-8">
        <h2 className="mb-4 text-lg font-bold text-foreground md:text-xl">{title}</h2>
        <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีนิยายในหมวดนี้</p>
      </section>
    )
  }

  return <NovelSection title={title} href={href} novels={novels} />
}

// Embla (loop:true ใน hero-carousel.tsx) ต้องมีอย่างน้อย 3 slide ถึงจะวนลูปได้ลื่นๆ —
// ถ้ามีน้อยกว่านั้น (เช่น carousel ทดสอบมีแค่ 2 แถว) ให้วนซ้ำจากอันแรกมาเติมจนครบ 3
const MIN_HERO_SLIDES = 3

function padSlidesForLoop(slides: HeroSlide[]): HeroSlide[] {
  if (slides.length === 0 || slides.length >= MIN_HERO_SLIDES) return slides
  const padded = [...slides]
  let i = slides.length
  while (padded.length < MIN_HERO_SLIDES) {
    const source = slides[i % slides.length]
    padded.push({ ...source, id: `${source.id}-loop${i}` })
    i++
  }
  return padded
}

function useCarouselsQuery() {
  return useQuery({
    queryKey: ['carousels'],
    // path เป็น /hero-slides ไม่ใช่ /carousels เพราะ ad blocker บล็อก URL ที่มีคำว่า
    // "carousel" เป็นค่าเริ่มต้น (ดู comment ที่ carouselRoutes ฝั่ง works.routes.ts)
    queryFn: () => api.get<{ data: ApiCarouselRow[] }>('/hero-slides').then((res) => res.data),
  })
}

export default function HomePage() {
  // เมนู "การแสดงผลเนื้อหา" (ไอคอนหัวใจ navbar) — 18+/BL/GL มีผลกับทุกแถวของหน้าแรก
  const { age18, bl, gl } = useContentPreferenceStore()
  const contentPref = contentPreferenceToParams({ age18, bl, gl })

  const carousels = useCarouselsQuery()
  const featured = useHomeSectionQuery('sales', 12, contentPref)
  const popular = useHomeSectionQuery('popular', 12, contentPref)
  const latest = useHomeSectionQuery('latest', 12, contentPref)

  const rankViews = useWorksQuery('popular', 5, contentPref)
  const rankLikes = useWorksQuery('likes', 5, contentPref)
  const rankSales = useWorksQuery('sales', 5, contentPref, 'week')

  // Hero Carousel: รูปโปรโมตจริงจากตาราง carousels (ไม่ใช่ปกนิยาย — ยังไม่มี admin CRUD
  // ให้จัดการผ่าน UI ตอนนี้ ต้องเพิ่มแถวผ่าน SQL ตรงๆ ไปก่อน ดู KNOWN_ISSUES.md)
  const heroSlides: HeroSlide[] = padSlidesForLoop(
    (carousels.data ?? []).map((row) => ({
      id: row.id,
      title: row.title ?? '',
      subtitle: row.subtitle ?? undefined,
      image: row.image_path,
      href: row.link_url ?? '#',
      displaySeconds: row.display_seconds,
    })),
  )

  const isRankingLoading = rankViews.isLoading || rankLikes.isLoading || rankSales.isLoading
  const isRankingError = rankViews.isError || rankLikes.isError || rankSales.isError

  return (
    <>
      <AnnouncementBar />
      {carousels.isLoading ? <HeroCarouselSkeleton /> : heroSlides.length > 0 ? <HeroCarousel slides={heroSlides} /> : null}

      <CategoryRow />

      <HomeSection title="เรื่องเด่นประจำสัปดาห์" href="/search?sort=sales&date_range=week" query={featured} />
      <HomeSection title="นิยมตลอดกาล" href="/gallery?collection=popular" query={popular} />
      <HomeSection title="ใหม่ล่าสุด" href="/gallery?collection=latest" query={latest} />

      {isRankingLoading ? (
        <RankingBoardSkeleton />
      ) : isRankingError ? (
        <section className="mx-auto mt-12 mb-20 max-w-[1280px] px-4 md:px-8">
          <p className="py-8 text-center text-sm text-destructive">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>
        </section>
      ) : (
        <RankingBoard
          topViews={mapWorksToRanking(rankViews.data ?? [])}
          topLikes={mapWorksToRanking(rankLikes.data ?? [])}
          topSales={mapWorksToRanking(rankSales.data ?? [])}
        />
      )}
    </>
  )
}
