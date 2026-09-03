'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Home, Bookmark, Share2, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { EpisodeTocDialog } from './episode-toc-dialog'
import { EpisodeAutoReadDialog } from './episode-auto-read-dialog'
import type { EpisodeAudio, EpisodeAudioVariant } from './episode-audio-player'
import type { NovelBlock, NovelBlockAudioTs } from '@/types'
import { ReadingSettingsPopover } from './reading-settings-popover'
import { formatEpisodeHeaderTitle } from '@/lib/episode-format'
import type { ReadingSettings } from '@/lib/reading-settings'
import type { EpisodeToc } from '@/lib/mock-work-detail'
import type { ApiWorkDetail } from '@/lib/work-detail-mapper'
import type { ApiEpisodeContent } from '@/app/(main)/works/[uuid]/read/[epNo]/episode-reader-client'

export function EpisodeReaderHeader({
  workUuid,
  episodes,
  epNo,
  epName,
  episodeLabel,
  isBookmarked,
  isEpBookmarked,
  isOwnWork,
  settings,
  onSettingsChange,
  onNavigate,
  audio,
  blocks,
  onActiveBlockChange,
  onAutoAdvance,
  showAutoRead,
  onAudioSeekerReady,
  onAudioTimelineChange,
  visible = true,
  floating = false,
  onInteraction,
}: {
  workUuid: string
  episodes: EpisodeToc[]
  epNo: number
  epName: string
  episodeLabel?: string | null
  isBookmarked: boolean
  isEpBookmarked: boolean
  isOwnWork: boolean
  settings: ReadingSettings
  onSettingsChange: (settings: ReadingSettings) => void
  onNavigate: (epNo: number) => void
  audio: EpisodeAudio | null | undefined
  blocks: NovelBlock[]
  onActiveBlockChange: (blockId: string | null) => void
  onAutoAdvance: (settings: { autoPurchase: boolean; voiceSlot: EpisodeAudioVariant['slot'] }) => void | Promise<void>
  showAutoRead: boolean
  onAudioSeekerReady?: (seeker: ((blockId: string) => void) | null) => void
  onAudioTimelineChange?: (timestamps: Record<string, NovelBlockAudioTs> | null) => void
  visible?: boolean
  floating?: boolean
  onInteraction?: () => void
}) {
  const token = useAuthStore((s) => s.token)
  const router = useRouter()
  const queryClient = useQueryClient()
  const [bookmarked, setBookmarked] = useState(isBookmarked)
  const [epBookmarked, setEpBookmarked] = useState(isEpBookmarked)

  // work/content query ของหน้านี้อาจโหลดเสร็จคนละรอบกัน (ดู page.tsx) — sync ค่าจริง
  // เข้ามาทับ default ตอน prop เปลี่ยนหลัง mount
  useEffect(() => {
    setBookmarked(isBookmarked)
  }, [isBookmarked])

  useEffect(() => {
    setEpBookmarked(isEpBookmarked)
  }, [isEpBookmarked])

  // sync กลับเข้า cache ของ query ['works', uuid] (คิวรีคีย์เดียวกับหน้ารายละเอียดนิยาย —
  // works/[uuid]/page.tsx) — เดิม toggle นี้อัปเดตแค่ useState ในนี้ ไม่เคยแตะ cache เลย พอสลับ
  // ไปหน้ารายละเอียดแล้วกลับมาภายใน staleTime (60 วิ) จะเห็นค่าเก่าย้อนกลับมา (ดูเหมือนข้อมูล
  // หาย ทั้งที่ backend บันทึกถูกต้องอยู่แล้ว — คนละเรื่องกับความเร็ว backend)
  function patchWorkCache(patch: Partial<Pick<ApiWorkDetail, 'is_bookmarked' | 'bookmark_count'>>) {
    queryClient.setQueryData<ApiWorkDetail>(['works', workUuid], (old) => (old ? { ...old, ...patch } : old))
  }

  async function toggleBookmark() {
    if (!token) {
      router.push('/login')
      return
    }
    if (isOwnWork) return
    const wasBookmarked = bookmarked
    setBookmarked(!wasBookmarked)
    const current = queryClient.getQueryData<ApiWorkDetail>(['works', workUuid])
    const nextCount = (current?.bookmark_count ?? 0) + (wasBookmarked ? -1 : 1)
    patchWorkCache({ is_bookmarked: !wasBookmarked, bookmark_count: nextCount })
    try {
      if (wasBookmarked) {
        await api.delete(`/social/bookmarks/${workUuid}`)
      } else {
        await api.post(`/social/bookmarks/${workUuid}`)
      }
    } catch (err: any) {
      setBookmarked(wasBookmarked)
      patchWorkCache({ is_bookmarked: wasBookmarked, bookmark_count: current?.bookmark_count })
    }
  }

  // บันทึกเฉพาะ "ตอนนี้" ไว้ดูทีหลัง (migration 023, 2026-07-29) — คนละอันกับปุ่มดาว
  // ด้านบนที่ติดตามทั้งเรื่อง ใช้ pattern optimistic update + revert เดียวกัน
  async function toggleEpisodeBookmark() {
    if (!token) {
      router.push('/login')
      return
    }
    const wasBookmarked = epBookmarked
    setEpBookmarked(!wasBookmarked)
    // sync cache ของ query ['works', uuid, 'episodes', epNo, 'read'] เหตุผลเดียวกับ toggleBookmark
    // ด้านบน (คีย์นี้เป็นคนละอันกับ ['works', uuid] เพราะ episode content คนละ query)
    queryClient.setQueryData<ApiEpisodeContent>(['works', workUuid, 'episodes', epNo, 'read'], (old) =>
      old ? { ...old, episode: { ...old.episode, is_ep_bookmarked: !wasBookmarked } } : old,
    )
    try {
      if (wasBookmarked) {
        await api.delete(`/social/episode-bookmarks/${workUuid}/${epNo}`)
      } else {
        await api.post(`/social/episode-bookmarks/${workUuid}/${epNo}`)
      }
    } catch (err: any) {
      setEpBookmarked(wasBookmarked)
      queryClient.setQueryData<ApiEpisodeContent>(['works', workUuid, 'episodes', epNo, 'read'], (old) =>
        old ? { ...old, episode: { ...old.episode, is_ep_bookmarked: wasBookmarked } } : old,
      )
    }
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href)
    toast.success('คัดลอกลิงก์แล้ว')
  }

  return (
    <div
      data-reader-header
      onPointerDown={onInteraction}
      className={cn(
        'sticky z-40 flex items-center justify-between gap-2 transition-[opacity,box-shadow] duration-500 sm:gap-4',
        floating
          ? 'top-[4.85rem] mx-1 rounded-[18px] border border-border bg-card/95 p-2.5 shadow-lg backdrop-blur sm:top-20 sm:mx-4 sm:rounded-[22px] sm:p-4 sm:px-6'
          : 'top-[4.35rem] rounded-t-[19px] border-b border-transparent bg-card p-3 sm:top-16 sm:rounded-t-[24px] sm:p-6',
        visible
          ? floating
            ? 'opacity-100 shadow-lg'
            : 'opacity-100 shadow-sm'
          : 'pointer-events-none opacity-0 shadow-none',
      )}
    >
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <Link
          href={`/works/${workUuid}`}
          aria-label="กลับหน้านิยาย"
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] bg-primary text-primary-foreground hover:bg-primary/90 sm:size-10"
        >
          <Home className="size-5" />
        </Link>
        <h1 className="truncate text-sm leading-snug font-bold text-primary sm:text-lg">
          {formatEpisodeHeaderTitle(epNo, episodeLabel, epName)}
        </h1>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-6">
        <EpisodeTocDialog episodes={episodes} currentEpNo={epNo} onNavigate={onNavigate} />
        {showAutoRead && <EpisodeAutoReadDialog workUuid={workUuid} epNo={epNo} audio={audio} blocks={blocks} onActiveBlockChange={onActiveBlockChange} onAutoAdvance={onAutoAdvance} onAudioSeekerReady={onAudioSeekerReady} onAudioTimelineChange={onAudioTimelineChange} />}
        <ReadingSettingsPopover settings={settings} onChange={onSettingsChange} />
        <button
          type="button"
          onClick={toggleBookmark}
          disabled={isOwnWork}
          aria-label={bookmarked ? 'เลิกติดตามเรื่อง' : 'ติดตามเรื่อง'}
          title={isOwnWork ? 'ติดตามผลงานตัวเองไม่ได้' : undefined}
          className={cn(
            'flex size-9 shrink-0 items-center justify-center sm:size-auto sm:flex-col sm:gap-1',
            isOwnWork ? 'cursor-not-allowed text-muted-foreground/50' : 'cursor-pointer',
            bookmarked && !isOwnWork
              ? 'text-yellow-500 hover:text-yellow-500'
              : !isOwnWork && 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Star className={cn('size-5', bookmarked && !isOwnWork && 'fill-current')} />
          <span className="hidden text-xs sm:block">ติดตาม</span>
        </button>
        <button
          type="button"
          onClick={toggleEpisodeBookmark}
          aria-label={epBookmarked ? 'เอาตอนนี้ออกจากที่บันทึกไว้' : 'บันทึกตอนนี้ไว้ดูทีหลัง'}
          className={cn(
            'flex size-9 shrink-0 cursor-pointer items-center justify-center sm:size-auto sm:flex-col sm:gap-1',
            epBookmarked
              ? 'text-emerald-600 hover:text-emerald-600'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Bookmark className={cn('size-5', epBookmarked && 'fill-current')} />
          <span className="hidden text-xs sm:block">บันทึกตอนนี้</span>
        </button>
        <button
          type="button"
          onClick={handleShare}
          aria-label="แชร์"
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground sm:size-auto sm:flex-col sm:gap-1"
        >
          <Share2 className="size-5" />
          <span className="hidden text-xs sm:block">แชร์</span>
        </button>
      </div>
    </div>
  )
}
