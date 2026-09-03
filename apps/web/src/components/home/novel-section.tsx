'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { NovelCard } from './novel-card'
import type { NovelCardData } from '@/types'

export function NovelSection({
  title,
  href,
  novels,
  renderCard,
}: {
  title: string
  href?: string
  novels: NovelCardData[]
  // ให้ Feed page (2026-07-29) เอาไปใช้กับการ์ดแบบอื่น (เช่น footer เป็นเลขตอน+เวลา แทน
  // stat ปกติ) โดยยังได้ shell แถวเลื่อนแนวนอน+ปุ่มเลื่อนซ้าย-ขวาเดิมมาฟรี ไม่ต้อง
  // สร้าง section ใหม่ซ้ำ — ไม่ส่งมา = พฤติกรรมเดิมเป๊ะ (การ์ดหน้าแรก)
  renderCard?: (novel: NovelCardData) => React.ReactNode
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function scroll(direction: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.8
    el.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  return (
    <section className="group/section relative mx-auto mt-12 max-w-[1280px] px-4 md:px-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="readji-page-title flex items-center gap-2 text-lg md:text-xl">
          <span className="h-5 w-1 rounded-full bg-primary/80" />
          {title}
        </h2>
        {href && (
          <Link
            href={href}
            className="flex items-center gap-0.5 rounded-full px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            ทั้งหมด
            <ChevronRight className="size-3.5" />
          </Link>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => scroll('left')}
          aria-label="เลื่อนซ้าย"
          className="absolute top-1/3 -left-4 z-10 hidden size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-xl border border-border/80 bg-card/95 opacity-0 shadow-lg transition-all hover:-translate-y-[55%] hover:bg-accent group-hover/section:opacity-100 md:flex"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => scroll('right')}
          aria-label="เลื่อนขวา"
          className="absolute top-1/3 -right-4 z-10 hidden size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-xl border border-border/80 bg-card/95 opacity-0 shadow-lg transition-all hover:-translate-y-[55%] hover:bg-accent group-hover/section:opacity-100 md:flex"
        >
          <ChevronRight className="size-5" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pt-3 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory md:gap-5 [&::-webkit-scrollbar]:hidden"
        >
          {novels.map((novel, index) => (
            <div key={novel.uuid} className="snap-start">
              {renderCard ? renderCard(novel) : <NovelCard novel={novel} priority={index < 3} />}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
