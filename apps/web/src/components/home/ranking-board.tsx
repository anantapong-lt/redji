import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, Eye, Heart, List } from 'lucide-react'
import { cn, formatCount } from '@/lib/utils'
import type { RankingEntry } from '@/types'

// สไตล์เลขอันดับ #1-5 ตาม Figma จริง (node 69:847 "Billboard") — #1 เด่นสุด (สีแทน+ตัวใหญ่กว่า)
// ไล่โทนคล้ายเหรียญ ทอง/เงิน/ทองแดง แล้วที่เหลือเป็นสีดำธรรมดา
const RANK_STYLE: Record<number, { color: string; size: string }> = {
  1: { color: '#d0c6b0', size: 'text-2xl' },
  2: { color: '#848484', size: 'text-base' },
  3: { color: '#a45a11', size: 'text-base' },
}

function RankingColumn({
  title,
  href,
  entries,
}: {
  title: string
  href: string
  entries: RankingEntry[]
}) {
  return (
    <div className="readji-surface overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between bg-gradient-to-br from-primary to-[#7a454c] px-5 py-4">
        <h3 className="text-lg font-bold tracking-[-0.02em] text-white">{title}</h3>
        <Link
          href={href}
          className="flex items-center gap-1.5 rounded-full border border-white/35 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/16"
        >
          ทั้งหมด...
          <ChevronRight className="size-3.5" />
        </Link>
      </div>

      <div className="flex flex-col">
        {entries.map((entry) => (
          <RankingRow key={entry.uuid} entry={entry} />
        ))}
      </div>
    </div>
  )
}

function RankingRow({ entry }: { entry: RankingEntry }) {
  const coverSrc = entry.cover_image ?? '/novel-cover-placeholder.png'
  const rankStyle = RANK_STYLE[entry.rank]

  return (
    <Link href={`/works/${entry.uuid}`} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent/55">
      <span
        className={cn('w-6 shrink-0 text-center font-bold', rankStyle?.size ?? 'text-base')}
        style={{ color: rankStyle?.color ?? '#000000' }}
      >
        #{entry.rank}
      </span>
      <div className="relative h-[82px] w-16 shrink-0 overflow-hidden rounded-xl bg-muted shadow-sm">
        <Image
          src={coverSrc}
          alt={entry.title}
          fill
          sizes="64px"
          unoptimized={coverSrc.startsWith('/')}
          className="object-cover transition-transform duration-300 group-hover:scale-110"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <h4 className="truncate text-lg font-bold tracking-[-0.02em] text-foreground">{entry.title}</h4>
        <p className="mb-2 truncate text-xs text-muted-foreground">{entry.author_name}</p>
        <div className="flex items-center gap-2.5 border-t border-primary/12 pt-2 text-xs">
          <span className="flex items-center gap-0.5 text-amber-700">
            <List className="size-3" />
            {entry.episode_count}
          </span>
          <span className="flex items-center gap-0.5 text-amber-700">
            <Eye className="size-3" />
            {formatCount(entry.view_count)}
          </span>
          <span className="flex items-center gap-0.5 text-rose-700">
            <Heart className="size-3" fill="currentColor" />
            {formatCount(entry.like_count)}
          </span>
        </div>
      </div>
    </Link>
  )
}

export function RankingBoard({
  topViews,
  topLikes,
  topSales,
}: {
  topViews: RankingEntry[]
  topLikes: RankingEntry[]
  topSales: RankingEntry[]
}) {
  return (
    <section className="mx-auto mt-12 mb-20 max-w-[1280px] px-4 md:px-8">
      <h2 className="readji-page-title mb-5 flex items-center gap-2 text-lg md:text-xl">
        <span className="h-5 w-1 rounded-full bg-primary/80" />
        จัดอันดับนิยายประจำสัปดาห์
      </h2>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <RankingColumn title="ยอดเข้าชมสูงสุด" href="/search?sort=popular&date_range=week" entries={topViews} />
        <RankingColumn title="ยอดคนกดใจเยอะสุด" href="/search?sort=likes&date_range=week" entries={topLikes} />
        <RankingColumn title="ยอดขายสูงสุด" href="/search?sort=sales&date_range=week" entries={topSales} />
      </div>
    </section>
  )
}
