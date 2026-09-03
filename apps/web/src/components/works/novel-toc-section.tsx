'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpDown, Coins } from 'lucide-react'
import { relativeTime } from '@/lib/relative-time'
import { cn } from '@/lib/utils'
import { formatEpisodeOrder } from '@/lib/episode-format'
import { useVisitedEpisodesStore, isEpisodeVisited } from '@/store/visited-episodes.store'
import { NumberedPagination } from './numbered-pagination'
import type { EpisodeToc } from '@/lib/mock-work-detail'

const LIST_HEIGHT = 420
const PAGE_SIZE = 50
const NEW_EPISODE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000 // จุดแดง = ตอนที่อัพในช่วง 3 วันล่าสุด

function isRecentlyUpdated(updatedAt: string) {
  return Date.now() - new Date(updatedAt).getTime() <= NEW_EPISODE_WINDOW_MS
}

export function NovelTocSection({
  workUuid,
  episodes,
}: {
  workUuid: string
  episodes: EpisodeToc[]
}) {
  const [ascending, setAscending] = useState(true)
  const [page, setPage] = useState(1)
  const visited = useVisitedEpisodesStore((s) => s.visited)
  const markVisited = useVisitedEpisodesStore((s) => s.markVisited)

  const sorted = useMemo(() => {
    const list = [...episodes].sort((a, b) => a.ep_no - b.ep_no)
    return ascending ? list : list.reverse()
  }, [episodes, ascending])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  function toggleAscending() {
    setAscending((a) => !a)
    setPage(1) // สลับลำดับแล้วเริ่มหน้า 1 ใหม่ ไม่งั้นเลขหน้าเดิมจะโชว์ตอนคนละชุดแบบไม่รู้ตัว
  }

  // ปุ่มเดียวกัน render ซ้ำ 2 จุด (บน/ล่างกล่อง) — ประกาศไว้ตัวเดียวใช้ร่วมกัน
  const pagination = <NumberedPagination page={currentPage} totalPages={totalPages} onPageChange={setPage} />

  return (
    <div>
      <div className="inline-block rounded-t-[15px] bg-primary px-6 py-2.5 text-base font-medium text-primary-foreground">
        สารบัญ
      </div>

      <div className="rounded-tr-[25px] rounded-b-[25px] border border-border/70 bg-card p-8 shadow-[0_24px_60px_-30px_rgb(84_37_43_/_0.55)]">
        <div className="mb-4 flex items-center justify-end gap-4">
          {pagination}
          <button
            type="button"
            onClick={toggleAscending}
            aria-label="สลับลำดับตอน"
            title={ascending ? 'เรียงตอนแรกก่อน' : 'เรียงตอนล่าสุดก่อน'}
            className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowUpDown className="size-5" />
          </button>
        </div>

        {/* Card info แบ่งคอลัมน์ตามความกว้างจอ — การ์ดเดียว (คอลัมน์เดียว) บนมือถือ ขยายเป็น 2
            แล้ว 3 คอลัมน์สุดที่จอกว้าง ไม่เกิน 3 ต่อให้จอกว้างแค่ไหน (เดิมเป็น list แถวยาวเดียว
            เต็มความกว้างเสมอ) — การ์ดเป็นก้อนเล็กๆ แนวนอนบรรทัดเดียว (ราคา/สถานะ, ลำดับตอน, ชื่อตอน,
            วันที่อัพ เรียงซ้ายไปขวาตามลำดับนี้) ไม่ใช่วางซ้อนหลายบรรทัดแบบรอบก่อน (สูงเกินไป) —
            ชื่อตอน (flex-1) ตัดด้วย ... ถ้ายาวเกินที่เหลือ ความสูงคงที่เท่าเดิม มีที่ว่างพอถ้าตอน
            น้อย และ scroll เองถ้าตอนเกิน */}
        <div
          className="grid grid-cols-1 content-start gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3"
          style={{ height: LIST_HEIGHT }}
        >
          {pageItems.map((ep) => {
            // 2026-08-05 user ขอ: ฟรี/ซื้อแล้ว ใช้สีเดียวกัน (เอาออกจากโทนเขียว) ส่วนที่ยังไม่ซื้อ
            // คงไอคอนเหรียญ+ราคาสีเดิมไว้ — และทั้งแถวจางลงถ้าอ่านไปแล้ว (is_read จาก backend)
            const unlocked = ep.is_free || ep.is_purchased
            // จุดแดง "ตอนใหม่" หายไปทันทีที่เคยกดเข้าไปแล้ว (visited store) หรืออ่านจริงแล้ว (is_read)
            // แม้กดเข้าไปแล้วโดนกันด้วยระบบซื้อตอนก็ให้หายเหมือนกัน ไม่งั้นจะดึงสายตาซ้ำๆ
            const showDot = isRecentlyUpdated(ep.updated_at) && !ep.is_read && !isEpisodeVisited(visited, workUuid, ep.ep_no)

            return (
              <Link
                key={ep.ep_id}
                href={`/works/${workUuid}/read/${ep.ep_no}`}
                onClick={() => markVisited(workUuid, ep.ep_no)}
                className={cn(
                  'relative flex h-fit shrink-0 items-center gap-2.5 rounded-[12px] bg-primary/10 px-4 py-2.5 text-sm hover:bg-primary/15',
                  ep.is_read && 'opacity-50',
                )}
              >
                <span
                  className={cn(
                    'flex shrink-0 items-center gap-1 font-medium',
                    unlocked ? 'text-muted-foreground' : 'text-amber-500',
                  )}
                >
                  {ep.is_free ? (
                    'ฟรี'
                  ) : ep.is_purchased ? (
                    'ซื้อแล้ว'
                  ) : (
                    <>
                      <Coins className="size-3.5" />
                      {Number(ep.ep_price)}
                    </>
                  )}
                </span>
                <span className="shrink-0 text-muted-foreground/70">{formatEpisodeOrder(ep.ep_no, ep.episode_label)}</span>
                <span className="min-w-0 flex-1 truncate text-foreground">{ep.ep_name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(ep.updated_at)}</span>
                {showDot && <span className="absolute top-2 right-2 size-2.5 shrink-0 rounded-full bg-red-500" />}
              </Link>
            )
          })}
        </div>

        {totalPages > 1 && <div className="mt-4 flex justify-end">{pagination}</div>}
      </div>
    </div>
  )
}
