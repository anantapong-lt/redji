'use client'

import { useEffect, useRef, useState } from 'react'
import { Ellipsis, Heart, LoaderCircle, MessageCircle, Pencil, Send, Trash2 } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'
import { LoginRequiredDialog } from '@/components/auth/login-required-dialog'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import {
  createChapterComment,
  deleteChapterComment,
  editChapterComment,
  getChapterComments,
  removeChapterCommentReaction,
  setChapterCommentReaction,
} from '@/controllers/content.controller'
import {
  CHAPTER_COMMENT_REACTION_TYPES,
  type ChapterComment,
  type ChapterCommentReaction,
} from '@/interface/content.interface'

const reactionMeta: Record<ChapterCommentReaction, { emoji: string; label: string; color: string }> = {
  like: { emoji: '👍', label: 'ถูกใจ', color: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300' },
  love: { emoji: '❤️', label: 'รักเลย', color: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  wow: { emoji: '😮', label: 'ว้าว', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  haha: { emoji: '😆', label: 'ฮ่าๆ', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' },
  sad: { emoji: '🥺', label: 'เศร้า', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' },
  angry: { emoji: '😤', label: 'โกรธ', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
}

function avatarInitial(comment: ChapterComment) {
  return comment.author.display_name.trim().charAt(0) || comment.author.username.charAt(0) || '?'
}

function formatCommentDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function ReactionSummary({ counts }: { counts: ChapterComment['reaction_counts'] }) {
  const entries = CHAPTER_COMMENT_REACTION_TYPES.filter((type) => (counts[type] ?? 0) > 0)
  const total = entries.reduce((sum, type) => sum + (counts[type] ?? 0), 0)
  if (!total) return null

  return (
    <span className="inline-flex items-center rounded-full border border-border bg-background px-1.5 py-0.5 text-xs shadow-sm">
      {entries.slice(0, 3).map((type) => (
        <span key={type}>{reactionMeta[type].emoji}</span>
      ))}
      <span className="ml-1 tabular-nums text-muted-foreground">{total.toLocaleString('th-TH')}</span>
    </span>
  )
}

export function ChapterComments({ slug, chapterNumber }: { slug: string; chapterNumber: string }) {
  const { accessToken, status, user } = useAuth()
  const [comments, setComments] = useState<ChapterComment[]>([])
  const [body, setBody] = useState('')
  const [replyingTo, setReplyingTo] = useState<ChapterComment | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isReactingId, setIsReactingId] = useState<string | null>(null)
  const [openReactionId, setOpenReactionId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [isUpdatingCommentId, setIsUpdatingCommentId] = useState<string | null>(null)
  const [isLoginRequiredDialogOpen, setIsLoginRequiredDialogOpen] = useState(false)
  const initialLoadKeyRef = useRef<string | null>(null)

  async function loadComments(nextPage = 1, append = false) {
    if (append) setIsLoadingMore(true)
    else if (comments.length === 0) setIsLoading(true)
    try {
      const result = await getChapterComments(slug, chapterNumber, undefined, nextPage)
      setComments((current) => (append ? [...current, ...result.comments] : result.comments))
      setCurrentPage(result.pagination.page)
      setHasMore(result.pagination.has_more)
      setErrorMessage(null)
    } catch {
      setErrorMessage('ยังโหลดความคิดเห็นไม่ได้ ลองใหม่อีกครั้งนะ')
    } finally {
      if (append) setIsLoadingMore(false)
      else setIsLoading(false)
    }
  }

  useEffect(() => {
    const loadKey = `${slug}:${chapterNumber}`
    if (initialLoadKeyRef.current === loadKey) return
    initialLoadKeyRef.current = loadKey
    void loadComments()
  }, [slug, chapterNumber])

  function requireLogin() {
    if (status !== 'authenticated' || !accessToken) {
      setIsLoginRequiredDialogOpen(true)
      return false
    }
    return true
  }

  async function submitComment() {
    if (!requireLogin() || !body.trim() || !accessToken || isSubmitting) return
    setIsSubmitting(true)
    try {
      const result = await createChapterComment(slug, chapterNumber, body, accessToken, replyingTo?.id)
      if (replyingTo) {
        setComments((current) =>
          current.map((comment) =>
            comment.id === replyingTo.id ? { ...comment, replies: [...comment.replies, result.comment] } : comment,
          ),
        )
      } else {
        // Current-user root comments are ranked first by the API.
        setComments((current) => [result.comment, ...current])
      }
      setBody('')
      setReplyingTo(null)
    } catch {
      setErrorMessage('ส่งความคิดเห็นไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function react(comment: ChapterComment, reaction: ChapterCommentReaction) {
    if (!requireLogin() || !accessToken || isReactingId) return
    setIsReactingId(comment.id)
    try {
      const result =
        comment.user_reaction === reaction
          ? await removeChapterCommentReaction(slug, chapterNumber, comment.id, accessToken)
          : await setChapterCommentReaction(slug, chapterNumber, comment.id, reaction, accessToken)
      const update = (item: ChapterComment): ChapterComment =>
        item.id === comment.id ? { ...item, ...result } : { ...item, replies: item.replies.map(update) }
      setComments((items) => items.map(update))
      setOpenReactionId(null)
    } catch {
      setErrorMessage('บันทึกรีแอ็กชันไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsReactingId(null)
    }
  }

  async function saveEditedComment(comment: ChapterComment, editedBody: string) {
    if (!requireLogin() || !accessToken || !editedBody.trim()) return
    setIsUpdatingCommentId(comment.id)
    try {
      const result = await editChapterComment(slug, chapterNumber, comment.id, editedBody, accessToken)
      const update = (item: ChapterComment): ChapterComment => item.id === comment.id
        ? { ...item, body: result.comment.body }
        : { ...item, replies: item.replies.map(update) }
      setComments((current) => current.map(update))
      setEditingCommentId(null)
    } catch {
      setErrorMessage('แก้ไขความคิดเห็นไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsUpdatingCommentId(null)
    }
  }

  async function removeComment(comment: ChapterComment) {
    if (!requireLogin() || !accessToken) return
    setIsUpdatingCommentId(comment.id)
    try {
      await deleteChapterComment(slug, chapterNumber, comment.id, accessToken)
      setComments((current) => current
        .filter((item) => item.id !== comment.id)
        .map((item) => ({ ...item, replies: item.replies.filter((reply) => reply.id !== comment.id) })))
    } catch {
      setErrorMessage('ลบความคิดเห็นไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsUpdatingCommentId(null)
    }
  }

  function CommentItem({ comment, isReply = false }: { comment: ChapterComment; isReply?: boolean }) {
    const selectedReaction = comment.user_reaction ? reactionMeta[comment.user_reaction] : null
    const isOwner = user?.id === comment.author.id
    const isEditing = editingCommentId === comment.id
    const [draftBody, setDraftBody] = useState(comment.body)
    return (
      <article className={isReply ? 'ml-5 border-l-2 border-primary/15 pl-3 sm:ml-10 sm:pl-4' : ''}>
        <div className="flex gap-2.5 sm:gap-3">
          <div className="relative size-9 shrink-0">
            <div className="flex size-full items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-extrabold text-primary">
              {comment.author.avatar_url ? (
                <img src={comment.author.avatar_url} alt="" className="size-full object-cover" />
              ) : (
                avatarInitial(comment)
              )}
            </div>
            {comment.is_chapter_owner ? (
              <span title="เจ้าของตอน" className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground">
                <Pencil className="size-2" aria-label="เจ้าของตอน" />
              </span>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <div className="rounded-2xl rounded-tl-md bg-muted/70 px-3.5 py-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-bold text-foreground">{comment.author.display_name}</span>
                <span className="text-xs text-muted-foreground">@{comment.author.username}</span>
                {isOwner ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon-xs" aria-label="เมนูความคิดเห็น" className="ml-auto text-muted-foreground">
                        <Ellipsis />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-40 gap-1 p-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCommentId(comment.id)
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium hover:bg-muted"
                      >
                        <Pencil className="size-3.5" />แก้ไข
                      </button>
                      <button
                        type="button"
                        disabled={isUpdatingCommentId === comment.id}
                        onClick={() => void removeComment(comment)}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        <Trash2 className="size-3.5" />ลบ
                      </button>
                    </PopoverContent>
                  </Popover>
                ) : null}
              </div>
              {isEditing ? (
                <div className="mt-2">
                  <Textarea
                    maxLength={2000}
                    autoFocus
                    disabled={isUpdatingCommentId === comment.id}
                    value={draftBody}
                    onChange={(event) => setDraftBody(event.target.value)}
                    className="min-h-20 bg-background"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditingCommentId(null)}>ยกเลิก</Button>
                    <Button type="button" size="sm" disabled={!draftBody.trim() || isUpdatingCommentId === comment.id} onClick={() => void saveEditedComment(comment, draftBody)}>
                      {isUpdatingCommentId === comment.id ? <LoaderCircle className="animate-spin" /> : <Pencil />}
                      บันทึก
                    </Button>
                  </div>
                </div>
              ) : <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{comment.body}</p>}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">{formatCommentDate(comment.created_at)}</span>
              <div className="group relative">
                <button
                  type="button"
                  onClick={() => {
                    if (comment.user_reaction) {
                      void react(comment, comment.user_reaction)
                    } else {
                      setOpenReactionId((current) => (current === comment.id ? null : comment.id))
                    }
                  }}
                  disabled={isReactingId === comment.id}
                  className={`rounded-full px-2 py-1 font-bold transition-colors hover:bg-primary/10 disabled:opacity-50 ${selectedReaction ? selectedReaction.color : 'text-muted-foreground hover:text-primary'}`}
                >
                  {selectedReaction ? `${selectedReaction.emoji} ${selectedReaction.label}` : 'ถูกใจ'}
                </button>
                <div
                  className={`${openReactionId === comment.id ? 'visible opacity-100' : 'invisible opacity-0'} absolute bottom-full left-0 z-10 mb-1 flex w-max gap-1 rounded-full border border-border bg-popover p-1.5 shadow-lg transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100`}
                >
                  {CHAPTER_COMMENT_REACTION_TYPES.map((reaction) => (
                    <button
                      key={reaction}
                      type="button"
                      aria-label={reactionMeta[reaction].label}
                      onClick={() => void react(comment, reaction)}
                      className="size-8 rounded-full text-lg transition-transform hover:scale-125 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {reactionMeta[reaction].emoji}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!requireLogin()) return
                  setReplyingTo(
                    isReply ? (comments.find((root) => root.id === comment.parent_comment_id) ?? null) : comment,
                  )
                  setBody('')
                }}
                className="rounded-full px-2 py-1 font-bold text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              >
                ตอบกลับ
              </button>
              <ReactionSummary counts={comment.reaction_counts} />
            </div>
          </div>
        </div>
        {!isReply && comment.replies.length > 0 ? (
          <div className="mt-3 space-y-3">
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} isReply />
            ))}
          </div>
        ) : null}
      </article>
    )
  }

  return (
    <section className="mx-auto mt-6 max-w-7xl px-1 sm:mt-8" aria-label="ความคิดเห็นของตอนนี้">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageCircle className="size-4" />
          </span>
          <div>
            <h2 className="font-extrabold text-foreground">ความคิดเห็น</h2>
            <p className="text-xs text-muted-foreground">ส่งความรู้สึก ตอบกลับ และสนุกไปกับเรื่องนี้</p>
          </div>
        </div>

        {replyingTo ? (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">
            <span>กำลังตอบกลับ {replyingTo.author.display_name}</span>
            <button type="button" onClick={() => setReplyingTo(null)} className="font-bold">
              ยกเลิก
            </button>
          </div>
        ) : null}
        <div className="mt-4">
          <Textarea
            value={body}
            maxLength={2000}
            disabled={status === 'loading' || isSubmitting}
            onChange={(event) => setBody(event.target.value)}
            onFocus={() => {
              if (status !== 'authenticated') requireLogin()
            }}
            placeholder={replyingTo ? 'เขียนคำตอบของคุณ...' : 'แบ่งปันความรู้สึกหลังอ่านตอนนี้...'}
            className="min-h-24 resize-y rounded-xl bg-background"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{body.length.toLocaleString('th-TH')}/2,000</span>
            <Button
              type="button"
              size="sm"
              onClick={() => void submitComment()}
              disabled={!body.trim() || isSubmitting}
            >
              {isSubmitting ? <LoaderCircle className="animate-spin" /> : <Send />}
              ส่งความคิดเห็น
            </Button>
          </div>
        </div>

        <div className="mt-6 space-y-5 border-t border-border pt-5">
          {errorMessage ? (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMessage}</p>
          ) : null}
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              กำลังโหลดความคิดเห็น...
            </div>
          ) : null}
          {!isLoading && comments.length === 0 ? (
            <div className="rounded-xl bg-muted/60 px-4 py-7 text-center text-sm text-muted-foreground">
              <Heart className="mx-auto mb-2 size-5 text-rose-400" />
              ยังไม่มีความคิดเห็น มาเป็นคนแรกที่ชวนคุยกันนะ
            </div>
          ) : null}
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
          {!isLoading && hasMore ? (
            <Button
              type="button"
              variant="outline"
              className="mx-auto flex"
              disabled={isLoadingMore}
              onClick={() => void loadComments(currentPage + 1, true)}
            >
              {isLoadingMore ? <LoaderCircle className="animate-spin" /> : <MessageCircle />}
              ดูความคิดเห็นเพิ่มเติม
            </Button>
          ) : null}
        </div>
      </div>
      <LoginRequiredDialog
        open={isLoginRequiredDialogOpen}
        onOpenChange={setIsLoginRequiredDialogOpen}
      />
    </section>
  )
}
