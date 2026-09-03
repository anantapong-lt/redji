'use client'

/**
 * app/(main)/feed/page.tsx — หน้าฟีด (login only, personalized)
 *
 * 4 หัวข้อเรียงตามที่ user ขอ (2026-07-29): อ่านล่าสุด / เรื่องที่กดดาว / บุ๊คมาร์ค / นักเขียนที่ติดตาม
 * แต่ละหัวข้อเป็น teaser row สั้นๆ (ไม่ใช่หน้ารวมเต็ม) เลื่อนแนวนอนแบบเดียวกับหน้าแรก — reuse
 * NovelSection ของหน้าแรก (เพิ่ม renderCard/href แบบ optional ให้แล้ว) ไม่สร้าง shell ใหม่ซ้ำ
 *
 * "อ่านล่าสุด"/"เรื่องที่กดดาว"/"บุ๊คมาร์ค" การ์ดหน้าตาเหมือนการ์ดหน้าแรกทุกอย่าง (โชว์แค่ชื่อเรื่อง
 * +คนแต่ง ไม่โชว์หมวดหมู่) แต่สลับแถบใต้เส้นจาก stat (ตอน/ยอดดู/หัวใจ) เป็นเลขตอน (+เวลา ถ้ามี)
 * แทน (ใช้ prop hideCategories/footer ใหม่ของ NovelCard)
 *
 * "นักเขียนที่ติดตาม" ใช้การ์ดปกติเป๊ะ (ตามที่ user ขอ "อัพเป็นแบบ Card ที่เป็นแบบในหน้า Home")
 *
 * 2026-07-29 มติแก้สำคัญ: "เรื่องที่กดดาว" กับ "บุ๊คมาร์ค" เดิมเข้าใจผิดว่าใช้ข้อมูลชุดเดียวกัน
 * (work_bookmarks) ต่างกันแค่ filter — ที่จริงคนละความหมายกัน: "ดาว" = ติดตามทั้งเรื่อง (ยัง
 * เป็น work_bookmarks, โผล่ตอนมีตอนใหม่ยังไม่อ่าน มีวันที่+badge "ใหม่") ส่วน "บุ๊คมาร์ค" = เก็บ
 * เฉพาะตอนที่ชอบไว้อ่านซ้ำ (work_ep_bookmarks ตัวใหม่ล่าสุด, ปุ่ม "บันทึกตอนนี้" ในหน้าอ่าน — ไม่มี
 * วันที่ให้โชว์เพราะไม่ใช่ "อัปเดต" อะไร แค่เก็บไว้เฉยๆ) — แก้ endpoint+การ์ดของ "บุ๊คมาร์ค" ให้ตรง
 *
 * ไม่มี guard เช็ค login แยก — ปล่อยให้ backend 401 แล้วโชว์ error message เหมือนหน้า
 * /history ที่ทำมาก่อนแล้ว (ดู pattern เดียวกันในไฟล์นั้น) ไม่อยากสร้างพฤติกรรมใหม่ซ้ำซ้อน
 */

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { NovelCard } from '@/components/home/novel-card'
import { NovelSection } from '@/components/home/novel-section'
import { HomeSectionSkeleton } from '@/components/loading/public-page-skeletons'
import { formatEpisodeOrder, formatEpisodeTitle } from '@/lib/episode-format'
import { formatRelativeTime } from '@/lib/utils'
import { api } from '@/lib/api'
import type { NovelCardData } from '@/types'

// ---- Shape ตรงกับ GET /feed/recently-read ----
interface ApiRecentlyReadRow {
  uuid: string
  title: string
  cover_image: string | null
  author_name: string
  ep_no: number
  ep_name: string | null
  episode_label: string | null
  read_at: string
}

// ---- Shape ตรงกับ GET /feed/starred-updates ----
interface ApiStarredRow {
  uuid: string
  title: string
  cover_image: string | null
  author_name: string
  ep_no: number
  ep_name: string | null
  episode_label: string | null
  ep_published_at: string
  is_new: boolean
}

// ---- Shape ตรงกับ GET /social/episode-bookmarks (data[]) ----
// 2026-07-29 มติแก้: "บุ๊คมาร์ค" ในหน้าฟีดคือบันทึกตอนเฉพาะ (work_ep_bookmarks, ปุ่ม "บันทึก
// ตอนนี้" ในหน้าอ่าน) ไม่ใช่ "ดาว" (work_bookmarks) ที่ใช้ตัวเดียวกับหัวข้อ "เรื่องที่กดดาว"
// ด้านบน — เดิมเข้าใจผิดว่าเป็นตัวเดียวกันเพราะตอนนั้น "บันทึกตอนนี้" ยังไม่มี ตอนนี้มีแล้ว
// เลยแยกออกจากกันชัดเจน: ดาว = ติดตามทั้งเรื่อง (โผล่ตอนมีอัปเดตใหม่), บุ๊คมาร์ค = เก็บเฉพาะ
// ตอนที่ชอบไว้อ่านซ้ำ (ไม่มีวันที่ให้โชว์ เพราะไม่ใช่ "อัปเดต" อะไร แค่เก็บไว้เฉยๆ)
interface ApiEpisodeBookmarkRow {
  uuid: string
  title: string
  cover_image: string | null
  author_name: string
  ep_no: number
  ep_name: string | null
  episode_label: string | null
  bookmarked_at: string
}

// ---- Shape ตรงกับ GET /feed/followed-writers (= GET /works) ----
interface ApiWorkListRow {
  uuid: string
  title: string
  cover_image: string | null
  view_count: string | null
  episode_count: number
  like_count: number
  extra_category_count: number
  age_rate: 'all' | '18+' | null
  tags: string[]
  author: { uuid: string; display_name: string; user_img: string | null }
  category_main: { id: string; name: string } | null
  category_sub: { id: string; name: string } | null
}

// เติมฟิลด์ที่การ์ด "อ่านล่าสุด"/"เรื่องที่กดดาว" ไม่ได้ใช้ (หมวดหมู่/stat) ด้วยค่าว่างๆ —
// hideCategories+footer ที่ส่งแยกจะบังการแสดงผลส่วนนั้นอยู่แล้ว ไม่กระทบ UI จริง
function toCardShell(row: { uuid: string; title: string; cover_image: string | null; author_name: string }): NovelCardData {
  return {
    uuid: row.uuid,
    title: row.title,
    cover_image: row.cover_image,
    author_name: row.author_name,
    category_main: null,
    category_sub: null,
    tags: [],
    extra_category_count: 0,
    episode_count: 0,
    view_count: 0,
    like_count: 0,
  }
}

function mapWorkRow(row: ApiWorkListRow): NovelCardData {
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

function episodeLine(epNo: number, episodeLabel: string | null, epName: string | null) {
  return epName ? formatEpisodeTitle(epNo, episodeLabel, epName) : formatEpisodeOrder(epNo, episodeLabel)
}

// ---- Shell แสดงหัวข้อ + loading/error/ว่าง (pattern เดียวกับ HomeSection หน้าแรก) ----
function FeedSection({
  title,
  isLoading,
  isError,
  isEmpty,
  emptyText,
  children,
}: {
  title: string
  isLoading: boolean
  isError: boolean
  isEmpty: boolean
  emptyText: string
  children: React.ReactNode
}) {
  if (isLoading) {
    return <HomeSectionSkeleton title={title} />
  }

  if (isError || isEmpty) {
    return (
      <section className="mx-auto mt-10 max-w-[1280px] px-4 md:px-8">
        <h2 className="mb-4 text-lg font-bold text-foreground md:text-xl">{title}</h2>
        <p className={`py-6 text-center text-sm ${isError ? 'text-destructive' : 'text-muted-foreground'}`}>
          {isLoading ? 'กำลังโหลด...' : isError ? 'โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง' : emptyText}
        </p>
      </section>
    )
  }
  return <>{children}</>
}

export default function FeedPage() {
  // refetchOnMount: 'always' เฉพาะ 2 อันนี้ — ค่าเปลี่ยนทันทีที่ไปอ่านตอนจากที่อื่นแล้วย้อนกลับมา
  // หน้านี้ (staleTime เดิม 60 วิ ของ QueryClient กลาง — providers.tsx — ทำให้เห็นข้อมูลค้างถ้าไม่
  // บังคับ refetch ตรงนี้ เพราะการอ่านตอนเกิดที่หน้าอื่น ไม่มีทางยิง invalidateQueries ข้ามหน้ามาได้ตรงๆ)
  const recentlyRead = useQuery({
    queryKey: ['feed', 'recently-read'],
    queryFn: () => api.get<{ data: ApiRecentlyReadRow[] }>('/feed/recently-read?limit=10').then((res) => res.data),
    refetchOnMount: 'always',
  })

  const starredUpdates = useQuery({
    queryKey: ['feed', 'starred-updates'],
    queryFn: () => api.get<{ data: ApiStarredRow[] }>('/feed/starred-updates?limit=10').then((res) => res.data),
    refetchOnMount: 'always',
  })

  const episodeBookmarks = useQuery({
    queryKey: ['feed', 'episode-bookmarks'],
    queryFn: () => api.get<{ data: ApiEpisodeBookmarkRow[] }>('/social/episode-bookmarks?limit=12').then((res) => res.data),
    refetchOnMount: 'always', // เหตุผลเดียวกับ recentlyRead/starredUpdates — บันทึกตอนเกิดที่หน้าอ่าน
  })

  const followedWriters = useQuery({
    queryKey: ['feed', 'followed-writers'],
    queryFn: () => api.get<{ data: ApiWorkListRow[] }>('/feed/followed-writers?limit=12').then((res) => res.data),
  })

  return (
    <>
      <h1 className="mx-auto mt-8 max-w-[1280px] px-4 text-[28px] font-bold text-primary md:px-8">ฟีด</h1>

      <FeedSection
        title="อ่านล่าสุด"
        isLoading={recentlyRead.isLoading}
        isError={recentlyRead.isError}
        isEmpty={(recentlyRead.data ?? []).length === 0}
        emptyText="ยังไม่มีประวัติการอ่าน ลองไปอ่านนิยายสักเรื่องดูสิ"
      >
        <NovelSection
          title="อ่านล่าสุด"
          href="/history"
          novels={(recentlyRead.data ?? []).map(toCardShell)}
          renderCard={(novel) => {
            const row = recentlyRead.data!.find((r) => r.uuid === novel.uuid)!
            return (
              <NovelCard
                novel={novel}
                hideCategories
                footer={
                  <div className="mt-2.5 flex flex-col gap-0.5 border-t border-[#b79240] pt-2 text-xs text-[#848484]">
                    <span className="truncate">{episodeLine(row.ep_no, row.episode_label, row.ep_name)}</span>
                    <span className="text-right">{formatRelativeTime(row.read_at)}</span>
                  </div>
                }
              />
            )
          }}
        />
      </FeedSection>

      <FeedSection
        title="เรื่องที่กดดาว"
        isLoading={starredUpdates.isLoading}
        isError={starredUpdates.isError}
        isEmpty={(starredUpdates.data ?? []).length === 0}
        emptyText="ยังไม่มีตอนใหม่จากเรื่องที่กดดาวไว้"
      >
        <NovelSection
          title="เรื่องที่กดดาว"
          novels={(starredUpdates.data ?? []).map(toCardShell)}
          renderCard={(novel) => {
            const row = starredUpdates.data!.find((r) => r.uuid === novel.uuid)!
            return (
              <NovelCard
                novel={novel}
                hideCategories
                footer={
                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[#b79240] pt-2 text-xs text-[#848484]">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate">{episodeLine(row.ep_no, row.episode_label, row.ep_name)}</span>
                      <span>{formatRelativeTime(row.ep_published_at)}</span>
                    </div>
                    {row.is_new && (
                      <span className="shrink-0 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        ใหม่
                      </span>
                    )}
                  </div>
                }
              />
            )
          }}
        />
      </FeedSection>

      <FeedSection
        title="บุ๊คมาร์ค"
        isLoading={episodeBookmarks.isLoading}
        isError={episodeBookmarks.isError}
        isEmpty={(episodeBookmarks.data ?? []).length === 0}
        emptyText="ยังไม่มีตอนที่บันทึกไว้ ลองกด &quot;บันทึกตอนนี้&quot; จากหน้าอ่านดูสิ"
      >
        <NovelSection
          title="บุ๊คมาร์ค"
          novels={(episodeBookmarks.data ?? []).map(toCardShell)}
          renderCard={(novel) => {
            const row = episodeBookmarks.data!.find((r) => r.uuid === novel.uuid)!
            return (
              <NovelCard
                novel={novel}
                hideCategories
                footer={
                  <div className="mt-2.5 border-t border-[#b79240] pt-2 text-xs text-[#848484]">
                    <span className="truncate">{episodeLine(row.ep_no, row.episode_label, row.ep_name)}</span>
                  </div>
                }
              />
            )
          }}
        />
      </FeedSection>

      <FeedSection
        title="นักเขียนที่ติดตาม"
        isLoading={followedWriters.isLoading}
        isError={followedWriters.isError}
        isEmpty={(followedWriters.data ?? []).length === 0}
        emptyText="ยังไม่มีผลงานใหม่จากนักเขียนที่ติดตาม — ลองไป follow นักเขียนที่ชอบดูสิ"
      >
        <NovelSection title="นักเขียนที่ติดตาม" novels={(followedWriters.data ?? []).map(mapWorkRow)} />
      </FeedSection>

      <div className="mb-20" />
    </>
  )
}
