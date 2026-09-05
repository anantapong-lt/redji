import { GiTwoCoins } from 'react-icons/gi'
import { Skeleton } from '@/components/ui/skeleton'
import type { WriterStats } from '@/interface/writer-stats.interface'
import { SITE_CONFIG } from '@/site.config'

const revenueCards = [
  { key: 'gross_sales', label: 'ยอดขายรวม', isCoins: true },
  { key: 'platform_revenue', label: 'ส่วนแบ่งเว็บไซต์', isCoins: true },
  { key: 'writer_revenue', label: 'รายได้สุทธิ', isCoins: true },
  { key: 'sales_count', label: 'จำนวนครั้งที่ขาย', isCoins: false },
] as const

interface WriterRevenueSectionProps {
  stats: WriterStats | null
  hasError: boolean
}

export function WriterRevenueSection({ stats, hasError }: WriterRevenueSectionProps) {
  return (
    <section className="mt-6" aria-labelledby="writer-revenue-heading">
      <h2 id="writer-revenue-heading" className="text-base font-semibold">
        รายได้และยอดขาย
      </h2>
      {hasError ? (
        <p role="alert" className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          ไม่สามารถโหลดรายได้และยอดขายได้ กรุณาลองใหม่อีกครั้ง
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2.5 xl:grid-cols-4">
          {revenueCards.map(({ key, label, isCoins }) => {
            return (
              <article
                key={key}
                className="min-w-0 rounded-xl border border-border/70 bg-card p-3 sm:p-4"
              >
                <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
                <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {stats ? (
                  <p className="min-w-0 break-words text-xl font-semibold tracking-tight text-foreground tabular-nums sm:text-2xl">
                    {Number(stats[key]).toLocaleString('th-TH', {
                      minimumFractionDigits: isCoins ? 2 : 0,
                      maximumFractionDigits: isCoins ? 2 : 0,
                    })}
                  </p>
                ) : (
                  <Skeleton className="h-7 w-20" aria-label={`กำลังโหลด${label}`} />
                )}
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {isCoins ? <GiTwoCoins className="size-3.5 text-primary" aria-hidden="true" /> : null}
                  {isCoins ? SITE_CONFIG.coinName : 'ครั้ง'}
                </p>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
