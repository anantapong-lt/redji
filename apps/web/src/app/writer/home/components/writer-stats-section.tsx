import { Eye, Heart, LibraryBig, ListOrdered, Unlock } from 'lucide-react'
import type { WriterStats } from '@/interface/writer-stats.interface'

const statCards = [
  { key: 'story_count', label: 'จำนวนเรื่อง', icon: LibraryBig },
  { key: 'chapter_count', label: 'จำนวนตอน', icon: ListOrdered },
  { key: 'total_views', label: 'จำนวนยอดวิว', icon: Eye },
  { key: 'favorite_count', label: 'จำนวนคนชื่นชอบ', icon: Heart },
  { key: 'free_chapter_count', label: 'จำนวนตอนฟรี', icon: Unlock },
] as const

interface WriterStatsSectionProps {
  stats: WriterStats | null
  hasError: boolean
}

export function WriterStatsSection({ stats, hasError }: WriterStatsSectionProps) {
  if (hasError) {
    return (
      <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
        ไม่สามารถโหลดสถิตินักเขียนได้ กรุณาลองใหม่อีกครั้ง
      </div>
    )
  }

  return (
    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6" aria-label="สถิตินักเขียน">
      {statCards.map(({ key, label, icon: Icon }) => (
        <article key={key} className="readji-surface rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
              <Icon className="size-5" strokeWidth={1.8} />
            </div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
          </div>
          {stats ? (
            <p className="mt-3 text-2xl font-bold tracking-[-0.025em]">
              {new Intl.NumberFormat('th-TH').format(Number(stats[key]))}
            </p>
          ) : (
            <div className="mt-2 h-7 w-16 animate-pulse rounded-md bg-muted" aria-label={`กำลังโหลด${label}`} />
          )}
        </article>
      ))}
      <article className="readji-surface rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
            <ListOrdered className="size-5" strokeWidth={1.8} />
          </div>
          <p className="text-sm font-medium text-muted-foreground">จำนวนตอนขาย</p>
        </div>
        <p className="mt-3 text-2xl font-bold tracking-[-0.025em]">276</p>
      </article>
    </section>
  )
}
