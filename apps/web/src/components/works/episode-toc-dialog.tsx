'use client'

import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, Coins, List } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatEpisodeOrder } from '@/lib/episode-format'
import type { EpisodeToc } from '@/lib/mock-work-detail'

export function EpisodeTocDialog({
  episodes,
  currentEpNo,
  onNavigate,
}: {
  episodes: EpisodeToc[]
  currentEpNo: number
  onNavigate: (epNo: number) => void
}) {
  const sorted = useMemo(() => [...episodes].sort((a, b) => a.ep_no - b.ep_no), [episodes])
  const currentIndex = sorted.findIndex((ep) => ep.ep_no === currentEpNo)
  const prevEp = currentIndex > 0 ? sorted[currentIndex - 1] : null
  const nextEp = currentIndex >= 0 && currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null

  function goTo(epNo: number) {
    onNavigate(epNo)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="สารบัญ"
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground sm:size-auto sm:flex-col sm:gap-1"
        >
          <List className="size-5" />
          <span className="hidden text-xs sm:block">สารบัญ</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>สารบัญ</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!prevEp}
            onClick={() => prevEp && goTo(prevEp.ep_no)}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-border py-2 text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
            ตอนก่อนหน้า
          </button>
          <button
            type="button"
            disabled={!nextEp}
            onClick={() => nextEp && goTo(nextEp.ep_no)}
            className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-border py-2 text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30"
          >
            ตอนถัดไป
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
          {sorted.map((ep) => {
            const isCurrent = ep.ep_no === currentEpNo
            // เพิ่มราคา/สถานะฟรี-ซื้อแล้วต่อตอน (เดิม dialog นี้ไม่มีเลย ต่างจากสารบัญนอกหน้าอ่าน
            // ที่ novel-toc-section.tsx มีอยู่แล้ว) — โทนสีเดียวกัน: ปลดล็อกแล้ว (ฟรี/ซื้อแล้ว) สีเทา,
            // ยังไม่ซื้อ สีส้ม+ไอคอนเหรียญ
            const unlocked = ep.is_free || ep.is_purchased
            return (
              <button
                key={ep.ep_id}
                type="button"
                onClick={() => goTo(ep.ep_no)}
                className={cn(
                  'flex shrink-0 cursor-pointer items-center gap-3 rounded-[10px] px-4 py-3 text-left text-sm',
                  isCurrent ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
                )}
              >
                <span className="flex flex-1 items-baseline gap-2.5 truncate">
                  <span className={cn('shrink-0 text-sm', isCurrent ? 'text-primary-foreground/70' : 'text-muted-foreground/70')}>
                    {formatEpisodeOrder(ep.ep_no, ep.episode_label)}
                  </span>
                  <span className="truncate">{ep.ep_name}</span>
                </span>
                <span
                  className={cn(
                    'flex shrink-0 items-center gap-1 text-xs font-medium',
                    unlocked ? (isCurrent ? 'text-primary-foreground/70' : 'text-muted-foreground') : 'text-amber-500',
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
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
