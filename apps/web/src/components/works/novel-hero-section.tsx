'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, Heart, MessageCircle, Star, ArrowRight, EllipsisVertical, Share2, Flag } from 'lucide-react'
import { cn, formatCount } from '@/lib/utils'
import { api } from '@/lib/api'
import { useAuthStore, useUser } from '@/store/auth.store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ReportDialog } from '@/components/works/report-dialog'
import { GenreTagRow } from './genre-tag-row'
import type { WorkDetail } from '@/lib/mock-work-detail'
import type { ApiWorkDetail } from '@/lib/work-detail-mapper'

function formatThaiDate(dateStr: string) {
  const THAI_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  const d = new Date(dateStr)
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}

export function NovelHeroSection({
  work,
  onSkipToToc,
  onJumpToComments,
}: {
  work: WorkDetail
  onSkipToToc: () => void
  onJumpToComments: () => void
}) {
  const token = useAuthStore((s) => s.token)
  const user = useUser()
  const router = useRouter()
  const queryClient = useQueryClient()
  // กดหัวใจ/ดาวผลงานตัวเองไม่ได้ (user เจอว่าปั่นยอดตัวเองได้ 2026-07-29) — เทียบ uuid เจ้าของ
  // ผลงานกับ user ที่ login อยู่ ปิดปุ่มไว้เลยฝั่ง UI (backend เช็คซ้ำอีกชั้นกันยิง API ตรงๆ)
  const isOwnWork = user?.uuid === work.author_uuid
  const [liked, setLiked] = useState(work.is_liked)
  const [likeCount, setLikeCount] = useState(work.like_count)
  const [bookmarked, setBookmarked] = useState(work.is_bookmarked)
  const [bookmarkCount, setBookmarkCount] = useState(work.bookmark_count)
  const [reportOpen, setReportOpen] = useState(false)

  const coverSrc = work.cover_image ?? '/novel-cover-placeholder.png'

  // sync กลับเข้า cache ของ query ['works', uuid] (ใช้ร่วมกับหน้าอ่านตอน — read/[epNo]/page.tsx
  // คิวรีคีย์เดียวกันเป๊ะ) เพราะ toggle เดิมอัปเดตแค่ useState ในนี้ ไม่เคยแตะ cache เลย — พอสลับ
  // หน้าไปมาแล้วกลับมาใหม่ภายใน staleTime (60 วิ, providers.tsx) จะได้ค่าเก่าจาก cache กลับมา
  // ทับ state ที่เพิ่งกดไปเงียบๆ (ดูเหมือนข้อมูลหาย/โหลดไม่ทัน ทั้งที่จริง backend บันทึกถูกต้อง
  // อยู่แล้ว เป็นแค่ cache ฝั่ง frontend ไม่ sync — คนละเรื่องกับความเร็ว backend เลย)
  function patchWorkCache(patch: Partial<Pick<ApiWorkDetail, 'is_liked' | 'like_count' | 'is_bookmarked' | 'bookmark_count'>>) {
    queryClient.setQueryData<ApiWorkDetail>(['works', work.uuid], (old) => (old ? { ...old, ...patch } : old))
  }

  // หัวใจ (like) ต่อ /social/favorites/:work_uuid จริงแล้ว (ตาราง work_favorite ตามมติ
  // 2026-07-12) — อัปเดต UI ก่อน (optimistic) แล้วค่อยยิง API ถ้าพังให้ revert กลับ
  async function toggleLike() {
    if (!token) {
      router.push('/login')
      return
    }
    if (isOwnWork) return
    const wasLiked = liked
    const nextCount = likeCount + (wasLiked ? -1 : 1)
    setLiked(!wasLiked)
    setLikeCount(nextCount)
    patchWorkCache({ is_liked: !wasLiked, like_count: nextCount })
    try {
      if (wasLiked) {
        await api.delete(`/social/favorites/${work.uuid}`)
      } else {
        await api.post(`/social/favorites/${work.uuid}`)
      }
    } catch (err: any) {
      setLiked(wasLiked)
      setLikeCount(likeCount)
      patchWorkCache({ is_liked: wasLiked, like_count: likeCount })
    }
  }

  // ดาวติดตามเรื่อง ต่อ /social/bookmarks/:work_uuid (ตาราง work_bookmarks) — Feed ใช้
  // รายการนี้แสดงตอนใหม่ที่ยังไม่ได้อ่าน ส่วนการเก็บ "ตอนนี้" ไว้อ่านภายหลังใช้
  // work_ep_bookmarks แยกต่างหากในหน้า Reader.
  async function toggleBookmark() {
    if (!token) {
      router.push('/login')
      return
    }
    if (isOwnWork) return
    const wasBookmarked = bookmarked
    const nextCount = bookmarkCount + (wasBookmarked ? -1 : 1)
    setBookmarked(!wasBookmarked)
    setBookmarkCount(nextCount)
    patchWorkCache({ is_bookmarked: !wasBookmarked, bookmark_count: nextCount })
    try {
      if (wasBookmarked) {
        await api.delete(`/social/bookmarks/${work.uuid}`)
      } else {
        await api.post(`/social/bookmarks/${work.uuid}`)
      }
    } catch (err: any) {
      setBookmarked(wasBookmarked)
      setBookmarkCount(bookmarkCount)
      patchWorkCache({ is_bookmarked: wasBookmarked, bookmark_count: bookmarkCount })
    }
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href)
    toast.success('คัดลอกลิงก์แล้ว')
  }

  function handleReport() {
    if (!token) {
      router.push('/login')
      return
    }
    setReportOpen(true)
  }

  return (
    <div className="overflow-hidden rounded-t-[25px] border border-b-0 border-border/70 bg-card shadow-[0_24px_60px_-30px_rgb(84_37_43_/_0.55)]">
      {/* def เปล่าไว้ให้ปุ่มดาว (เก็บเข้าคลัง) อ้างอิงตอน active — เขียว→เหลือง ตามที่ user ขอ
          (SVG gradient เท่านั้นที่ทำให้ fill/stroke ไอคอนเป็น gradient จริงได้ CSS text-color
          ธรรมดาทำไม่ได้) ใช้ id เดียวกับที่ episode-reader-header.tsx อ้างอิงด้วย ให้ดูสอดคล้องกัน
          ทั้ง 2 หน้า — ไม่กระทบ layout เพราะ 0x0 ไม่แสดงผลอะไรเอง */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="star-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#eab308" />
          </linearGradient>
        </defs>
      </svg>
      <div className="p-4 sm:p-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-[375px_1fr]">
          <div className="mx-auto flex w-full max-w-[375px] flex-col gap-6">
            <div className="relative aspect-[5/7] w-full overflow-hidden rounded-[25px] bg-muted shadow-[0_14px_30px_-18px_rgb(84_37_43_/_0.45)]">
              <Image
                src={coverSrc}
                alt={work.title}
                fill
                sizes="375px"
                unoptimized={coverSrc.startsWith('/')}
                className="object-cover"
                priority
              />
            </div>

            <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Eye className="size-5 text-amber-500" />
                {formatCount(work.view_count)}
              </span>
              <span className="flex items-center gap-1.5">
                <Heart className="size-5 text-pink-500" />
                {formatCount(likeCount)}
              </span>
              <button
                type="button"
                onClick={onJumpToComments}
                className="flex cursor-pointer items-center gap-1.5 hover:text-foreground"
              >
                <MessageCircle className="size-5 text-sky-500" />
                {formatCount(work.comment_count)}
              </button>
              <span className="flex items-center gap-1.5">
                <Star className="size-5 text-primary" />
                {formatCount(bookmarkCount)}
              </span>
            </div>
          </div>

          <div className="flex flex-col">
            {work.category_main && (
              <span className="mb-4 sm:mb-12 text-sm text-muted-foreground">{work.category_main.name}</span>
            )}

            <h1 className="mb-4 sm:mb-12 text-2xl leading-tight font-bold text-primary sm:text-4xl">{work.title}</h1>

            <span className="mb-4 sm:mb-12 text-sm text-muted-foreground">{formatThaiDate(work.created_at)}</span>

            <Link
              href={`/profile/${work.author_uuid}`}
              className="mb-4 sm:mb-12 flex items-center gap-3 rounded-[15px] bg-primary/10 py-2 pr-2 pl-3 hover:bg-primary/15"
            >
              <Avatar size="lg">
                <AvatarImage src={work.author_img ?? undefined} alt={work.author_name} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {work.author_name.slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 text-sm font-medium text-foreground">{work.author_name}</span>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-card text-foreground">
                <ArrowRight className="size-4" />
              </span>
            </Link>

            <div className="mb-4 sm:mb-12 flex items-center gap-1.5 sm:gap-2.5">
              <div className="flex h-12 sm:h-14 flex-1 overflow-hidden rounded-[15px] shadow-[0_14px_30px_-18px_rgb(84_37_43_/_0.45)]">
                <Link
                  href={work.first_ep_no !== null ? `/works/${work.uuid}/read/${work.first_ep_no}` : '#'}
                  className="flex flex-[3] cursor-pointer items-center justify-center bg-primary px-2 sm:px-4 whitespace-nowrap text-sm sm:text-base font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  อ่านตั้งแต่ต้น
                </Link>
                <Link
                  href={work.latest_ep_no !== null ? `/works/${work.uuid}/read/${work.latest_ep_no}` : '#'}
                  className="flex flex-[2] cursor-pointer items-center justify-center border-l border-black/10 bg-primary/15 px-2 sm:px-4 whitespace-nowrap text-sm sm:text-base font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  ล่าสุด
                </Link>
              </div>

              <button
                type="button"
                onClick={toggleBookmark}
                disabled={isOwnWork}
                aria-label={bookmarked ? 'เลิกติดตามเรื่อง' : 'ติดตามเรื่อง'}
                title={isOwnWork ? 'ติดตามผลงานตัวเองไม่ได้' : undefined}
                className={cn(
                  // จอแคบมากถึงบีบปุ่มอ่านจนตัวหนังสือเสี่ยงตกบรรทัดอีก — ย้ายปุ่มนี้เข้าไปรวมกับ
                  // เมนู "..." แทน (ดู PopoverContent ด้านล่าง) เหลือแค่ปุ่มเมนูเดียวในแถวนี้
                  'hidden shrink-0 items-center justify-center self-center rounded-[15px] border transition-all sm:flex sm:size-12',
                  isOwnWork
                    ? 'cursor-not-allowed border-border/70 text-muted-foreground/50'
                    : 'cursor-pointer border-border/70 text-muted-foreground hover:-translate-y-0.5 hover:border-border hover:bg-muted hover:shadow-sm',
                  bookmarked && !isOwnWork && 'border-yellow-500 bg-gradient-to-br from-green-50 to-yellow-50',
                )}
              >
                {/* active = fill/stroke เป็น gradient เขียว→เหลือง (อ้างอิง def ด้านบนสุดของไฟล์) — CSS
                    text-color ธรรมดาทำ gradient บนไอคอนไม่ได้ ต้องตั้ง fill/stroke ของ SVG ตรงๆ */}
                <Star
                  className="size-5"
                  fill={bookmarked && !isOwnWork ? 'url(#star-gradient)' : 'none'}
                  stroke={bookmarked && !isOwnWork ? 'url(#star-gradient)' : 'currentColor'}
                />
              </button>
              <button
                type="button"
                onClick={toggleLike}
                disabled={isOwnWork}
                aria-label={liked ? 'เลิกกดหัวใจ' : 'กดหัวใจ'}
                title={isOwnWork ? 'กดหัวใจผลงานตัวเองไม่ได้' : undefined}
                className={cn(
                  'hidden shrink-0 items-center justify-center self-center rounded-[15px] border transition-all sm:flex sm:size-12',
                  isOwnWork
                    ? 'cursor-not-allowed border-border/70 text-muted-foreground/50'
                    : 'cursor-pointer border-border/70 text-muted-foreground hover:-translate-y-0.5 hover:border-border hover:bg-muted hover:shadow-sm',
                  liked && !isOwnWork && 'border-pink-500 bg-pink-50 text-pink-500',
                )}
              >
                <Heart className={cn('size-5', liked && !isOwnWork && 'fill-current')} />
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label="ตัวเลือกเพิ่มเติม"
                    className="flex size-10 sm:size-12 shrink-0 cursor-pointer items-center justify-center self-center rounded-[15px] border border-border/70 text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-border hover:bg-muted hover:shadow-sm"
                  >
                    <EllipsisVertical className="size-5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-44 gap-1 p-1.5">
                  {/* คู่กับปุ่มดาว/หัวใจแบบ standalone ด้านนอก (sm:flex ข้างบน) — โผล่เฉพาะจอแคบที่ปุ่ม
                      เหล่านั้นถูกซ่อนไปแล้ว ไม่ใช่ปุ่มเพิ่มใหม่ แค่ย้ายที่อยู่ตามขนาดจอ */}
                  <button
                    type="button"
                    onClick={toggleBookmark}
                    disabled={isOwnWork}
                    title={isOwnWork ? 'ติดตามผลงานตัวเองไม่ได้' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm sm:hidden',
                      isOwnWork ? 'cursor-not-allowed text-muted-foreground/50' : 'cursor-pointer text-foreground hover:bg-muted',
                    )}
                  >
                    <Star className="size-4" fill={bookmarked && !isOwnWork ? 'url(#star-gradient)' : 'none'} />
                    {bookmarked ? 'เลิกติดตามเรื่อง' : 'ติดตามเรื่อง'}
                  </button>
                  <button
                    type="button"
                    onClick={toggleLike}
                    disabled={isOwnWork}
                    title={isOwnWork ? 'กดหัวใจผลงานตัวเองไม่ได้' : undefined}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm sm:hidden',
                      isOwnWork ? 'cursor-not-allowed text-muted-foreground/50' : 'cursor-pointer text-foreground hover:bg-muted',
                    )}
                  >
                    <Heart className={cn('size-4', liked && !isOwnWork && 'fill-current text-pink-500')} />
                    {liked ? 'เลิกกดใจ' : 'กดใจ'}
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted"
                  >
                    <Share2 className="size-4" />
                    แชร์
                  </button>
                  <button
                    type="button"
                    onClick={handleReport}
                    className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm text-destructive hover:bg-muted"
                  >
                    <Flag className="size-4" />
                    รายงาน
                  </button>
                </PopoverContent>
              </Popover>
            </div>

            <div className="mb-4 sm:mb-12">
              <GenreTagRow ageRate={work.age_rate} categoryMain={work.category_main} categorySub={work.category_sub} tags={work.tags} />
            </div>

            {work.description && (
              <p className="line-clamp-3 text-sm text-muted-foreground italic">
                &ldquo;{work.description}&rdquo;
              </p>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onSkipToToc}
        className="w-full cursor-pointer bg-primary py-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        ข้ามหน้าแนะนำเรื่อง
      </button>

      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="work"
        targetRef={work.uuid}
        title={`รายงานนิยาย "${work.title}"`}
      />
    </div>
  )
}
