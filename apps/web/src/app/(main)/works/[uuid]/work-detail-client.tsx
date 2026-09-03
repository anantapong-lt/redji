'use client'

import { useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { NovelHeroSection } from '@/components/works/novel-hero-section'
import { SynopsisReader } from '@/components/works/synopsis-reader'
import { NovelTocSection } from '@/components/works/novel-toc-section'
import { NovelCommentsSection } from '@/components/works/novel-comments-section'
import { AgeGate } from '@/components/works/age-gate'
import { WorkDetailSkeleton } from '@/components/loading/public-page-skeletons'
import { api } from '@/lib/api'
import {
  mapWorkDetail,
  mapEpisodes,
  mapComments,
  COMMENTS_PAGE_SIZE,
  type ApiWorkDetail,
  type ApiCommentsResponse,
} from '@/lib/work-detail-mapper'

export function WorkDetailClient() {
  const { uuid } = useParams<{ uuid: string }>()
  const tocRef = useRef<HTMLDivElement>(null)
  const commentsRef = useRef<HTMLDivElement>(null)

  // ว่าง = ทั้งหมด, ใส่เลข = กรองเฉพาะตอนนั้น — ต้องส่งไป backend เพราะ pagination
  // เป็นแบบ server-side แล้ว กรองฝั่ง client เหมือนเดิมไม่ได้ (เห็นแค่หน้าที่โหลดมา)
  const [commentEpFilter, setCommentEpFilter] = useState('')
  const [commentPage, setCommentPage] = useState(1)

  function handleEpFilterChange(value: string) {
    setCommentEpFilter(value)
    setCommentPage(1)
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['works', uuid],
    queryFn: () => api.get<{ data: ApiWorkDetail }>(`/works/${uuid}`).then((res) => res.data),
  })

  const { data: commentsRes, refetch: refetchComments } = useQuery({
    queryKey: ['works', uuid, 'comments', commentPage, commentEpFilter],
    queryFn: () =>
      api.get<ApiCommentsResponse>(
        `/works/${uuid}/comments?page=${commentPage}&limit=${COMMENTS_PAGE_SIZE}` +
          (commentEpFilter !== '' ? `&ep_no=${commentEpFilter}` : ''),
      ),
  })

  function scrollToToc() {
    tocRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function scrollToComments() {
    commentsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (isLoading) {
    return <WorkDetailSkeleton />
  }

  if (isError || !data) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-[1216px] items-center justify-center px-4 text-center text-sm text-destructive">
        ไม่พบนิยายเรื่องนี้ หรือยังไม่ได้เผยแพร่
      </div>
    )
  }

  const work = mapWorkDetail(data)
  const episodes = mapEpisodes(data)
  const comments = mapComments(commentsRes?.data ?? [])
  const commentTotalPages = commentsRes?.pagination.pages ?? 1

  return (
    <div className="mx-auto flex max-w-[1216px] flex-col gap-8 px-4 py-10 sm:px-6">
      <AgeGate ageRate={work.age_rate} />

      <div>
        <NovelHeroSection work={work} onSkipToToc={scrollToToc} onJumpToComments={scrollToComments} />

        {/* ต่อขอบชิดกับส่วนที่ 1 ไปเลย ให้ดูเป็นก้อนเดียวกัน — ไม่มี gap/border-top/rounded-top
            shadow ค่าเดียวกับ hero section ด้านบน (ไม่มี gap คั่น กล่องล่างจะ paint ทับเงาส่วน
            ล่างของ hero พอดี เลยดูเป็นเงาต่อเนื่องก้อนเดียว ไม่เห็นรอยต่อ) */}
        <div className="rounded-b-[25px] border border-t-0 border-border/70 bg-card px-8 py-16 shadow-[0_24px_60px_-30px_rgb(84_37_43_/_0.55)] sm:px-16 sm:py-28">
          <SynopsisReader content={work.synopsis} />
        </div>
      </div>

      <div ref={tocRef}>
        <NovelTocSection workUuid={work.uuid} episodes={episodes} />
      </div>

      <div ref={commentsRef}>
        <NovelCommentsSection
          workUuid={work.uuid}
          comments={comments}
          episodes={episodes}
          epFilter={commentEpFilter}
          onEpFilterChange={handleEpFilterChange}
          page={commentPage}
          totalPages={commentTotalPages}
          onPageChange={setCommentPage}
          onCommentPosted={() => refetchComments()}
        />
      </div>
    </div>
  )
}
