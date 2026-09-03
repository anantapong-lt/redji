'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Heart, Flag, Send, Smile } from 'lucide-react'
import { relativeTime } from '@/lib/relative-time'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ReportDialog } from '@/components/works/report-dialog'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import type { EpisodeToc, WorkComment } from '@/lib/mock-work-detail'
import type { ApiCommentsResponse } from '@/lib/work-detail-mapper'

export function NovelCommentsSection({
  workUuid,
  comments,
  episodes,
  epFilter,
  onEpFilterChange,
  page,
  totalPages,
  onPageChange,
  onCommentPosted,
}: {
  workUuid: string
  comments: WorkComment[]
  episodes: EpisodeToc[]
  // ว่าง = ทั้งหมด, ใส่เลข = กรองเฉพาะตอนนั้น — เป็น controlled component เพราะ pagination
  // ยิง query ไป backend จริงแล้ว (ดู KNOWN_ISSUES.md — เดิมกรอง+แบ่งหน้าฝั่ง client จาก
  // batch ที่ backend ตัด limit ไว้แค่ 20 แถวแรก ทำให้คอมเม้นเกิน 20 เข้าไม่ถึงเลย)
  epFilter: string
  onEpFilterChange: (value: string) => void
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  onCommentPosted: () => void
}) {
  const token = useAuthStore((s) => s.token)
  const router = useRouter()
  const queryClient = useQueryClient()
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [reportTarget, setReportTarget] = useState<WorkComment | null>(null)
  // เก็บ optimistic override ไว้ในเครื่อง — ยิง API จริงแล้ว (POST/DELETE /social/comments/:id/like)
  // แต่ยังไม่ refetch ทันทีเพื่อความไว ใช้ override นี้บังกับค่าจาก props ไปก่อน
  const [likes, setLikes] = useState<Record<string, { liked: boolean; count: number }>>({})

  function getLikeState(c: WorkComment) {
    return likes[c.id] ?? { liked: c.is_liked, count: c.likes_count }
  }

  // sync กลับเข้า cache ของทุก query ['works', uuid, 'comments', ...] (คีย์มี commentPage/
  // epFilter ต่อท้ายไม่แน่นอน ใช้ setQueriesData แบบ partial-match prefix แทนเจาะจงคีย์เดียว)
  // เดิม toggle นี้อัปเดตแค่ useState (likes) ในตัว component ไม่เคยแตะ cache เลย พอสลับหน้าไปมา
  // แล้วกลับมาภายใน staleTime จะเห็นค่าไลค์เก่าย้อนกลับมา ทั้งที่ backend บันทึกถูกต้องแล้ว
  function patchCommentLikeCache(commentId: string, liked: boolean, count: number) {
    queryClient.setQueriesData<ApiCommentsResponse>({ queryKey: ['works', workUuid, 'comments'] }, (old) =>
      old ? { ...old, data: old.data.map((c) => (c.id === commentId ? { ...c, is_liked: liked, likes_count: count } : c)) } : old,
    )
  }

  async function toggleLike(c: WorkComment) {
    if (!token) {
      router.push('/login')
      return
    }
    const current = getLikeState(c)
    const next = { liked: !current.liked, count: current.count + (current.liked ? -1 : 1) }
    setLikes((prev) => ({ ...prev, [c.id]: next }))
    patchCommentLikeCache(c.id, next.liked, next.count)
    try {
      if (current.liked) {
        await api.delete(`/social/comments/${c.id}/like`)
      } else {
        await api.post(`/social/comments/${c.id}/like`)
      }
    } catch (err: any) {
      setLikes((prev) => ({ ...prev, [c.id]: current }))
      patchCommentLikeCache(c.id, current.liked, current.count)
    }
  }

  function handleReport(c: WorkComment) {
    if (!token) {
      router.push('/login')
      return
    }
    setReportTarget(c)
  }

  async function handleSend() {
    if (!input.trim()) return
    if (!token) {
      router.push('/login')
      return
    }
    setSending(true)
    try {
      await api.post(`/works/${workUuid}/comments`, { content: input.trim() })
      setInput('')
      onCommentPosted()
    } catch (err: any) {
    } finally {
      setSending(false)
    }
  }

  const maxEpNo = episodes.reduce((max, ep) => Math.max(max, ep.ep_no), 0)

  return (
    <div>
      <div className="inline-block rounded-t-[15px] bg-primary px-6 py-2.5 text-base font-medium text-primary-foreground">
        ความคิดเห็น
      </div>

      <div className="flex flex-col gap-6 rounded-tr-[25px] rounded-b-[25px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-30px_rgb(84_37_43_/_0.55)] sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="ep-filter" className="text-sm text-muted-foreground">
            แสดงความคิดเห็นจากตอนที่
          </label>
          <input
            id="ep-filter"
            type="number"
            min={0}
            max={maxEpNo}
            value={epFilter}
            onChange={(e) => onEpFilterChange(e.target.value)}
            placeholder="ทั้งหมด"
            className="h-10 w-28 rounded-[10px] border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {epFilter !== '' && (
            <button
              type="button"
              onClick={() => onEpFilterChange('')}
              className="cursor-pointer text-sm text-primary hover:underline"
            >
              ล้าง (ดูทั้งหมด)
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 rounded-[15px] border border-input px-4 py-3">
          <Smile className="size-5 shrink-0 text-muted-foreground" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend()
            }}
            placeholder="แสดงความคิดเห็น..."
            className="flex-1 bg-transparent text-sm outline-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            aria-label="ส่งความคิดเห็น"
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-6">
          {comments.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีความคิดเห็น</p>
          )}
          {comments.map((c) => {
            const likeState = getLikeState(c)
            return (
              <div key={c.id} className="flex gap-4">
                <Avatar size="default">
                  <AvatarImage src={c.author_img ?? undefined} alt={c.author_name} />
                  <AvatarFallback>{c.author_name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{c.author_name}</span>
                    {c.is_author && (
                      <span className="rounded-full border border-primary px-2.5 py-0.5 text-xs font-medium text-primary">
                        ผู้เขียน
                      </span>
                    )}
                    <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                      {c.episode_no === null ? 'หน้าเรื่อง' : `ตอนที่ ${c.episode_no}`}
                    </span>
                    <span className="text-xs text-muted-foreground">{relativeTime(c.created_at)}</span>
                  </div>
                  <p className="mb-2 text-sm text-foreground">{c.content}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => toggleLike(c)}
                      className={cn(
                        'flex cursor-pointer items-center gap-1 hover:text-red-500',
                        likeState.liked && 'text-red-500',
                      )}
                    >
                      <Heart className={cn('size-3.5', likeState.liked && 'fill-current')} />
                      {likeState.count}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReport(c)}
                      className="flex cursor-pointer items-center gap-1 hover:text-destructive"
                    >
                      <Flag className="size-3.5" />
                      รายงาน
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-end gap-4 border-t border-border pt-5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="หน้าก่อนหน้า"
            className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-border disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="หน้าถัดไป"
            className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-border disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <ReportDialog
        open={reportTarget !== null}
        onOpenChange={(open) => { if (!open) setReportTarget(null) }}
        targetType="comment"
        targetRef={reportTarget?.id ?? ''}
        title={`รายงานคอมเม้นของ ${reportTarget?.author_name ?? ''}`}
      />
    </div>
  )
}
