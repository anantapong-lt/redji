'use client'

import Link from 'next/link'
import { useGenreOptionsStore } from '@/store/genre-options.store'

export function PopularTagsSection({ id = 'popular-tags', onNavigate }: { id?: string; onNavigate?: () => void }) {
  const options = useGenreOptionsStore((state) => state.options)
  const status = useGenreOptionsStore((state) => state.status)
  const tags = options.slice(0, 10)

  return (
    <aside id={id} aria-labelledby={`${id}-heading`} className="w-full scroll-mt-4">
      <div className="rounded-md bg-card p-4">
        <h2 id={`${id}-heading`} className="text-lg font-bold tracking-tight text-foreground">
          แท็กยอดนิยม
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">แท็กที่ผู้อ่านกำลังสนใจ</p>

        {status === 'idle' || status === 'loading' ? (
          <div className="mt-4 flex flex-wrap gap-2" aria-label="กำลังโหลดแท็ก">
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} className="h-7 w-16 animate-pulse rounded-full bg-muted" />
            ))}
          </div>
        ) : status === 'error' ? (
          <p className="mt-4 text-xs text-destructive">โหลดแท็กไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>
        ) : tags.length === 0 ? (
          <p className="mt-4 text-xs text-muted-foreground">ยังไม่มีข้อมูลแท็ก</p>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag.value}>
                <Link
                  href={`/search?category=${encodeURIComponent(tag.slug)}`}
                  onClick={onNavigate}
                  className="inline-flex rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10 hover:text-primary hover:shadow-sm"
                >
                  #{tag.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
