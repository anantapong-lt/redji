'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { useAuthStore, useUser } from '@/store/auth.store'
import { EpisodeReaderHeader } from '@/components/works/episode-reader-header'
import { EpisodeContentReader } from '@/components/works/episode-content-reader'
import type { EpisodeAudio, EpisodeAudioVariant } from '@/components/works/episode-audio-player'
import { EpisodeImageReader, type EpisodeImage } from '@/components/works/episode-image-reader'
import { EpisodeBottomNav } from '@/components/works/episode-bottom-nav'
import { ScrollNavButtons } from '@/components/works/scroll-nav-buttons'
import { EpisodeSelectDropdown } from '@/components/works/episode-select-dropdown'
import { EpisodeCommentsSection } from '@/components/works/episode-comments-section'
import { AgeGate } from '@/components/works/age-gate'
import { ReaderSkeleton } from '@/components/loading/public-page-skeletons'
import { PurchaseConfirmDialog } from '@/components/works/purchase-confirm-dialog'
import { usePurchaseConfirmStore, shouldSkipPurchaseConfirm } from '@/store/purchase-confirm.store'
import { api } from '@/lib/api'
import {
  mapEpisodes,
  mapComments,
  COMMENTS_PAGE_SIZE,
  type ApiWorkDetail,
  type ApiCommentsResponse,
} from '@/lib/work-detail-mapper'
import type { EpisodeToc } from '@/lib/mock-work-detail'
import {
  DEFAULT_READING_SETTINGS,
  loadReadingSettings,
  saveReadingSettings,
  type ReadingSettings,
} from '@/lib/reading-settings'
import type { NovelBlock, NovelBlockAudioTs } from '@/types'

export interface ApiEpisodeContent {
  type: 'novel' | 'manga'
  work: { uuid: string; title: string }
  episode: {
    ep_id: string
    ep_name: string
    ep_no: number
    ep_price: string
    is_free: boolean
    lock_duration_days: number | null
    reader_message: string | null
    episode_label: string | null
    is_ep_bookmarked: boolean
  }
  blocks?: NovelBlock[]
  images?: EpisodeImage[]
  audio?: EpisodeAudio | null
}

export function EpisodeReaderClient() {
  const params = useParams<{ uuid: string; epNo: string }>()
  const workUuid = params.uuid
  const epNo = Number(params.epNo)
  const user = useUser()
  const updatePoints = useAuthStore((s) => s.updatePoints)
  const queryClient = useQueryClient()
  const router = useRouter()

  const [settings, setSettings] = useState<ReadingSettings>(DEFAULT_READING_SETTINGS)
  const [commentPage, setCommentPage] = useState(1)
  const [activeAudioBlockId, setActiveAudioBlockId] = useState<string | null>(null)
  const [audioTimestamps, setAudioTimestamps] = useState<Record<string, NovelBlockAudioTs> | null>(null)
  const [autoReadSeekEnabled, setAutoReadSeekEnabled] = useState(false)
  const [readerHeaderVisible, setReaderHeaderVisible] = useState(true)
  const [readerHeaderFloating, setReaderHeaderFloating] = useState(false)
  const headerHideTimer = useRef<number | null>(null)
  const readerHeaderVisibleRef = useRef(true)
  const readerHeaderFloatingRef = useRef(false)
  const audioBlockSeekerRef = useRef<((blockId: string) => void) | null>(null)
  const automaticScrollUntil = useRef(0)

  // 2026-08-05 modal ยืนยันซื้อตอน — แก้รอบ 2 ตาม feedback: เดิม navigate ไปตอนใหม่ก่อนแล้วค่อยเจอ
  // error (ต้องมาโชว์หน้าตันแล้วกดย้อนกลับเองถ้ายกเลิก) ตอนนี้ "ดัก" ก่อน navigate เลย — เช็คจาก
  // episodes list (มี is_free/is_purchased อยู่แล้ว) ว่าตอนเป้าหมายต้องซื้อไหม ถ้าไม่ต้อง navigate
  // ตรงๆ ทันที ถ้าต้อง เปิด modal ลอยไว้เฉยๆ "ไม่ navigate ไปก่อน" ยกเลิกก็แค่ปิด modal อยู่ที่เดิม
  // ไม่ต้องกดย้อนกลับเพิ่ม — pendingTargetEpNo แยกจาก epNo (URL ปัจจุบัน) เพราะเป้าหมายที่กำลังจะซื้อ
  // อาจไม่ใช่ตอนที่กำลังเปิดอยู่เลยก็ได้ (เช่นกด "ตอนถัดไป" ตอนนี้)
  const [pendingTargetEpNo, setPendingTargetEpNo] = useState<number | null>(null)
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false)
  const [purchaseBusy, setPurchaseBusy] = useState(false)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const skipUntil = usePurchaseConfirmStore((s) => s.skipUntil)
  const skipFor7Days = usePurchaseConfirmStore((s) => s.skipFor7Days)

  // เปลี่ยนตอน (URL จริงเปลี่ยน) → เคลียร์สถานะ modal ของตอนเก่าทิ้งเสมอ กันค้างข้ามตอน
  useEffect(() => {
    setPurchaseDialogOpen(false)
    setPurchaseError(null)
    setPendingTargetEpNo(null)
  }, [epNo])

  // โหลดจาก localStorage หลัง mount (client-only กัน hydration mismatch)
  useEffect(() => {
    setSettings(loadReadingSettings())
  }, [])

  // เปลี่ยนตอน → คอมเม้นของตอนใหม่ควรเริ่มที่หน้า 1 เสมอ (ไม่ใช่ค้างหน้าที่เปิดไว้ในตอนก่อนหน้า)
  useEffect(() => {
    setCommentPage(1)
    setActiveAudioBlockId(null)
    setAudioTimestamps(null)
    audioBlockSeekerRef.current = null
    setAutoReadSeekEnabled(false)
    readerHeaderVisibleRef.current = true
    readerHeaderFloatingRef.current = false
    setReaderHeaderVisible(true)
    setReaderHeaderFloating(false)
  }, [epNo])

  const setAudioBlockSeeker = useCallback((seeker: ((blockId: string) => void) | null) => {
    audioBlockSeekerRef.current = seeker
    setAutoReadSeekEnabled(Boolean(seeker))
  }, [])

  const seekAudioToBlock = useCallback((blockId: string) => {
    audioBlockSeekerRef.current?.(blockId)
  }, [])

  const keepReaderHeaderVisible = useCallback(() => {
    readerHeaderVisibleRef.current = true
    setReaderHeaderVisible(true)
    if (headerHideTimer.current !== null) window.clearTimeout(headerHideTimer.current)
    headerHideTimer.current = null
  }, [])

  const toggleReaderHeader = useCallback(() => {
    if (headerHideTimer.current !== null) window.clearTimeout(headerHideTimer.current)
    headerHideTimer.current = null
    readerHeaderVisibleRef.current = !readerHeaderVisibleRef.current
    setReaderHeaderVisible(readerHeaderVisibleRef.current)
  }, [])

  const scheduleReaderHeaderFade = useCallback((duration = 1800) => {
    if (headerHideTimer.current !== null) window.clearTimeout(headerHideTimer.current)
    headerHideTimer.current = window.setTimeout(() => {
      readerHeaderVisibleRef.current = false
      setReaderHeaderVisible(false)
      headerHideTimer.current = null
    }, duration)
  }, [])

  const updateReaderHeaderFloating = useCallback(() => {
    // Hysteresis avoids repeatedly docking/undocking at one scroll position,
    // which is especially noticeable with a desktop mouse wheel.
    const nextFloating = readerHeaderFloatingRef.current
      ? window.scrollY > 48
      : window.scrollY >= 112
    if (nextFloating !== readerHeaderFloatingRef.current) {
      readerHeaderFloatingRef.current = nextFloating
      setReaderHeaderFloating(nextFloating)
    }
    return nextFloating
  }, [])

  useEffect(() => {
    function handleScroll() {
      const isPastHeader = updateReaderHeaderFloating()
      if (!isPastHeader) {
        keepReaderHeaderVisible()
        return
      }
      if (performance.now() < automaticScrollUntil.current) return
      // Scrolling only makes a currently visible header fade away. It never
      // revives a hidden header; the reader explicitly brings it back by tap.
      if (readerHeaderVisibleRef.current) scheduleReaderHeaderFade()
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    updateReaderHeaderFloating()
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (headerHideTimer.current !== null) window.clearTimeout(headerHideTimer.current)
    }
  }, [keepReaderHeaderVisible, scheduleReaderHeaderFade, updateReaderHeaderFloating])

  useEffect(() => {
    function handleReaderTap(event: MouseEvent) {
      if (!(event.target instanceof Element) || !event.target.closest('[data-reader-content]')) return
      if (event.target.closest('[data-audio-seek]')) return
      toggleReaderHeader()
    }
    document.addEventListener('click', handleReaderTap)
    return () => document.removeEventListener('click', handleReaderTap)
  }, [toggleReaderHeader])

  useEffect(() => {
    if (!activeAudioBlockId) return
    const element = [...document.querySelectorAll<HTMLElement>('[data-audio-block-id]')]
      .find((node) => node.dataset.audioBlockId === activeAudioBlockId)
    if (!element) return

    const rect = element.getBoundingClientRect()
    const currentCenter = rect.top + (rect.height / 2)
    const targetCenter = window.innerHeight / 2
    if (Math.abs(currentCenter - targetCenter) < window.innerHeight * 0.16) return

    const maxTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    const destination = Math.max(0, Math.min(maxTop, window.scrollY + currentCenter - targetCenter))
    const startTop = window.scrollY
    const distance = destination - startTop
    const duration = 850
    const startedAt = performance.now()
    let frame = 0
    automaticScrollUntil.current = startedAt + duration + 200

    const move = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - ((-2 * progress + 2) ** 2 / 2)
      window.scrollTo(0, startTop + (distance * eased))
      if (progress < 1) frame = window.requestAnimationFrame(move)
    }
    frame = window.requestAnimationFrame(move)
    return () => window.cancelAnimationFrame(frame)
  }, [activeAudioBlockId])

  // 2026-08-05 user ขอบล็อกคลิกขวาทั้งหน้าตอนอยู่ในหน้าอ่าน (ต่อยอดจากที่ป้องกันลากคัดลอกข้อความ
  // ไว้แล้วที่ episode-content-reader.tsx) — ผูกที่ document ระดับ mount/unmount ของหน้านี้เอง
  // ไม่ใช่ผูกกับ div ใด div หนึ่ง เพราะต้องครอบทั้งหน้ารวมถึงตอน loading/error ด้วย ไม่ใช่แค่ส่วน
  // เนื้อหา ถอดออกอัตโนมัติทันทีที่ออกจากหน้านี้ (ไม่กระทบหน้าอื่นในเว็บ)
  useEffect(() => {
    function blockContextMenu(e: MouseEvent) {
      e.preventDefault()
    }
    document.addEventListener('contextmenu', blockContextMenu)
    return () => document.removeEventListener('contextmenu', blockContextMenu)
  }, [])

  // 2026-08-05 user ขอกันปุ่มลัดเปิด DevTools ด้วย (ยอมรับเองว่าเป็นแค่ "หลอกๆ" ไม่ใช่การป้องกันจริง
  // จัง — F12 บล็อกไม่ได้ใน Chrome ปัจจุบัน (เบราว์เซอร์กันไว้ระดับ native ไม่ให้ preventDefault มีผล)
  // แต่ Ctrl/Cmd+Shift+I,J,C (inspect/console) กับ Ctrl/Cmd+U (view source) ยัง preventDefault
  // ได้ผลในหลายเบราว์เซอร์ — เรียก preventDefault ไปตามที่ทำได้ ไม่รับประกันว่ากันได้ทุกเบราว์เซอร์/
  // ทุกเวอร์ชัน
  useEffect(() => {
    function blockDevToolsKeys(e: KeyboardEvent) {
      const key = e.key.toLowerCase()
      const isInspectShortcut = (e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(key)
      const isViewSource = (e.ctrlKey || e.metaKey) && key === 'u'
      if (e.key === 'F12' || isInspectShortcut || isViewSource) {
        e.preventDefault()
      }
    }
    document.addEventListener('keydown', blockDevToolsKeys)
    return () => document.removeEventListener('keydown', blockDevToolsKeys)
  }, [])

  function handleSettingsChange(next: ReadingSettings) {
    setSettings(next)
    saveReadingSettings(next)
  }

  // query key เดียวกับหน้ารายละเอียดนิยาย — ใช้ cache ร่วมกันได้ถ้าเพิ่งมาจากหน้านั้น
  // เอาไว้สร้างสารบัญ/ปุ่มเลื่อนตอนก่อนหน้า-ถัดไป
  const { data: work } = useQuery({
    queryKey: ['works', workUuid],
    queryFn: () => api.get<{ data: ApiWorkDetail }>(`/works/${workUuid}`).then((res) => res.data),
  })
  const episodes = work ? mapEpisodes(work) : []
  // กันกดหัวใจ/ดาว/บันทึกตอนผลงานตัวเอง (เหมือน novel-hero-section.tsx — 2026-07-29)
  const isOwnWork = user?.uuid === work?.author.uuid

  const { data: content, isLoading, error } = useQuery({
    queryKey: ['works', workUuid, 'episodes', epNo, 'read'],
    queryFn: () =>
      api
        .get<{ data: ApiEpisodeContent }>(`/works/${workUuid}/episodes/${epNo}/read`)
        .then((res) => res.data),
    retry: false, // 401/403/404 ไม่ใช่ error ชั่วคราว ลองใหม่ไปก็ผลลัพธ์เดิม
  })

  const { data: commentsRes, refetch: refetchComments } = useQuery({
    queryKey: ['works', workUuid, 'comments', epNo, commentPage],
    queryFn: () =>
      api.get<ApiCommentsResponse>(
        `/works/${workUuid}/comments?ep_no=${epNo}&page=${commentPage}&limit=${COMMENTS_PAGE_SIZE}`,
      ),
    enabled: !!content, // โหลดคอมเม้นหลังยืนยันว่ามีสิทธิ์อ่านตอนนี้แล้วเท่านั้น
  })

  const contentErrorMessage = (error as { message?: string } | null)?.message
  const currentEpMeta = episodes.find((e) => e.ep_no === epNo) ?? null
  const pendingTargetMeta = pendingTargetEpNo !== null ? (episodes.find((e) => e.ep_no === pendingTargetEpNo) ?? null) : null

  // ปุ่ม/dropdown/สารบัญ ทุกจุดเรียกจุดเดียวนี้แทน Link/router.push ตรงๆ — เช็คก่อนว่าตอนเป้าหมาย
  // ต้องซื้อไหม (ใช้ is_free/is_purchased ที่มากับ episodes list อยู่แล้ว ไม่ต้องรอ round-trip
  // ไปเจอ error ถึงจะรู้)
  function handleNavigateToEpisode(targetEpNo: number) {
    const target = episodes.find((e) => e.ep_no === targetEpNo)
    if (!target || target.is_free || target.is_purchased) {
      router.push(`/works/${workUuid}/read/${targetEpNo}`)
      return
    }
    setPurchaseError(null)
    setPendingTargetEpNo(targetEpNo)
    if (shouldSkipPurchaseConfirm(skipUntil)) {
      attemptPurchase(target)
    } else {
      setPurchaseDialogOpen(true)
    }
  }

  async function handleAutoAdvance({ autoPurchase, voiceSlot }: { autoPurchase: boolean; voiceSlot: EpisodeAudioVariant['slot'] }) {
    const nextEpisode = episodes
      .filter((episode) => episode.ep_no > epNo)
      .sort((left, right) => left.ep_no - right.ep_no)[0]
    if (!nextEpisode) {
      return
    }
    if (nextEpisode.is_free || nextEpisode.is_purchased) {
      // Future page-turn sound hook: play it immediately before this navigation.
      window.sessionStorage.setItem(`readji:auto-read:continue:${workUuid}`, JSON.stringify({ ep_no: nextEpisode.ep_no, voice_slot: voiceSlot }))
      router.push(`/works/${workUuid}/read/${nextEpisode.ep_no}`)
      return
    }
    if (!autoPurchase) {
      return
    }
    await attemptPurchase(nextEpisode, { automatic: true, continueAutoRead: true, voiceSlot })
  }

  async function attemptPurchase(target: EpisodeToc, options: { automatic?: boolean; continueAutoRead?: boolean; voiceSlot?: EpisodeAudioVariant['slot'] } = {}) {
    setPurchaseBusy(true)
    setPurchaseError(null)
    try {
      const res = await api.post<{ data: { new_balance: string } }>('/purchase/episodes', {
        ep_ids: [Number(target.ep_id)],
      })
      // เหรียญมุมขวาบนอ่านจาก useAuthStore (navbar/index.tsx) ไม่ใช่ query — ถ้าไม่อัปเดตตรงนี้
      // จะยังขึ้นเลขเก่าค้างจนกว่าจะ refresh/relogin ทั้งที่ DB หักไปแล้วจริง (backend คืน
      // new_balance มาให้พร้อมอยู่แล้วในทุก purchase response — เดิมแค่ไม่ได้เอามาใช้)
      updatePoints(Number(res.data.new_balance))
      setPurchaseDialogOpen(false)
      setPendingTargetEpNo(null)
      // invalidate ด้วย prefix ['works', workUuid] ครอบคลุมทั้ง work query (episodes list,
      // is_purchased ใหม่) และ content query ของ epNo นี้ไปในตัว (query key ของ content คือ
      // ['works', workUuid, 'episodes', epNo, 'read'] ซึ่งขึ้นต้นด้วย prefix เดียวกัน)
      await queryClient.invalidateQueries({ queryKey: ['works', workUuid] })
      if (target.ep_no !== epNo) {
        // Future coin-success sound belongs above this navigation; the purchase
        // API response has already committed the balance at this point.
        if (options.continueAutoRead) {
          window.sessionStorage.setItem(`readji:auto-read:continue:${workUuid}`, JSON.stringify({ ep_no: target.ep_no, voice_slot: options.voiceSlot }))
        }
        router.push(`/works/${workUuid}/read/${target.ep_no}`)
      }
    } catch (err: any) {
      // เผื่อกรณี auto-purchase (ตั้งข้ามการถามไว้) แล้วล้มเหลว (เช่นเหรียญไม่พอ) — ต้องเปิด modal
      // ให้เห็น error ด้วย ไม่ปล่อยให้เงียบหายไปเฉยๆ
      const message = err?.message ?? 'ซื้อไม่สำเร็จ ลองใหม่อีกครั้ง'
      if (options.automatic) {
        return
      }
      setPurchaseError(message)
      setPurchaseDialogOpen(true)
    } finally {
      setPurchaseBusy(false)
    }
  }

  // เข้าหน้านี้ตรงๆ (ลิงก์ตรง/รีเฟรช) แล้วเจอว่าตอนปัจจุบันต้องซื้อ — เคสเดียวที่ยัง navigate มาก่อน
  // เจอ error ทีหลัง (ไม่มีทางเลี่ยง ต้องมี URL ให้ตกลงมาก่อนถึงจะรู้) พฤติกรรมหลังจากนี้เหมือนกับ
  // handleNavigateToEpisode ทุกอย่าง (ถามยืนยัน/ข้ามถ้าตั้งไว้)
  useEffect(() => {
    if (contentErrorMessage !== 'ตอนนี้ต้องซื้อก่อนอ่าน' || !currentEpMeta || pendingTargetEpNo !== null) return
    setPendingTargetEpNo(epNo)
    if (shouldSkipPurchaseConfirm(skipUntil)) {
      attemptPurchase(currentEpMeta)
    } else {
      setPurchaseDialogOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentErrorMessage, epNo, currentEpMeta?.ep_id])

  if (isLoading) {
    return (
      <>
        <AgeGate ageRate={work?.age_rate} />
        <ReaderSkeleton />
      </>
    )
  }

  // apiFetch โยน body ของ response ที่ไม่ ok ออกมาตรงๆ (ไม่ใช่ Error instance) —
  // แยกเคสตามข้อความที่ backend ส่งมา (getEpisodeContent, works.routes.ts)
  // ⚠️ กรณี guest (ไม่มี token เลย) โดน 401 — apiFetch (lib/api.ts) จะพยายาม refresh token
  // ก่อนเสมอ พอ refresh ไม่ผ่าน (ไม่มี refresh cookie) จะโยน Error('Session expired') ทับ
  // ข้อความเดิมจาก backend ไปแทน — endpoint นี้ไม่มีทางคืน 401 ด้วยเหตุผลอื่นนอกจาก
  // LOGIN_REQUIRED (ตอนฟรีไม่เช็ค token เลย) จึงถือว่า 401 ทุกกรณีคือ LOGIN_REQUIRED ได้เลย
  if (error) {
    const message = (error as { message?: string })?.message

    if (message === 'กรุณาล็อกอินก่อน' || message === 'Session expired') {
      return (
        <div className="mx-auto flex max-w-[1216px] flex-col items-center gap-4 px-4 py-20 text-center">
          <p className="text-sm text-muted-foreground">ตอนนี้ต้องเข้าสู่ระบบก่อนถึงจะอ่านได้</p>
          <Link
            href="/login"
            className="rounded-[10px] bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      )
    }

    if (message === 'ตอนนี้ต้องซื้อก่อนอ่าน') {
      // 2026-08-05: หน้านี้ควรเจอน้อยลงมากแล้ว (ปุ่มตอนถัดไป/dropdown/สารบัญ ดักก่อน navigate
      // หมดแล้ว) เหลือแค่เคสเข้าลิงก์ตรง/รีเฟรชตอนล็อก — ปรับให้ดูมีน้ำหนักพอสมควรกับพื้นที่ hero
      // gradient ด้านหลัง (เดิมข้อความสั้นเกินไปจนดูโหว่/เพี้ยนสัดส่วน ตามที่ user ทัก)
      return (
        <>
          <div className="mx-auto flex max-w-[1216px] flex-col items-center gap-4 px-4 py-24 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lock className="size-6" />
            </div>
            <p className="text-sm text-muted-foreground">ตอนนี้ต้องซื้อก่อนถึงจะอ่านได้</p>
            <div className="flex items-center gap-3">
              {currentEpMeta && (
                <button
                  type="button"
                  onClick={() => {
                    setPendingTargetEpNo(epNo)
                    setPurchaseDialogOpen(true)
                  }}
                  className="cursor-pointer rounded-[10px] bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  ซื้อตอนนี้
                </button>
              )}
              <Link
                href={`/works/${workUuid}`}
                className="rounded-[10px] border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                กลับไปหน้านิยาย
              </Link>
            </div>
          </div>

          {pendingTargetMeta && (
            <PurchaseConfirmDialog
              open={purchaseDialogOpen}
              workTitle={work?.title ?? ''}
              epNo={pendingTargetMeta.ep_no}
              epLabel={pendingTargetMeta.episode_label}
              epName={pendingTargetMeta.ep_name}
              price={Number(pendingTargetMeta.ep_price)}
              busy={purchaseBusy}
              error={purchaseError}
              onConfirm={(skip) => {
                if (skip) skipFor7Days()
                attemptPurchase(pendingTargetMeta)
              }}
              onCancel={() => setPurchaseDialogOpen(false)}
            />
          )}
        </>
      )
    }

    return (
      <div className="mx-auto max-w-[1216px] px-4 py-20 text-center text-muted-foreground">
        ไม่พบตอนนี้
      </div>
    )
  }

  if (!content) return null

  const episodeComments = mapComments(commentsRes?.data ?? [])
  const commentTotalPages = commentsRes?.pagination.pages ?? 1

  return (
    <div className="mx-auto flex max-w-[1216px] flex-col gap-5 px-3 py-4 sm:gap-8 sm:px-6 sm:py-10">
      <AgeGate ageRate={work?.age_rate} />
      <ScrollNavButtons />

      <div>
        <div className={`rounded-[20px] border border-border bg-card sm:rounded-[25px] ${content.type === 'novel' ? 'overflow-visible' : 'overflow-hidden'}`}>
          <EpisodeReaderHeader
            workUuid={workUuid}
            episodes={episodes}
            epNo={content.episode.ep_no}
            epName={content.episode.ep_name}
            episodeLabel={content.episode.episode_label}
            isBookmarked={work?.is_bookmarked ?? false}
            isEpBookmarked={content.episode.is_ep_bookmarked}
            isOwnWork={isOwnWork}
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onNavigate={handleNavigateToEpisode}
            audio={content.type === 'novel' ? content.audio : null}
            blocks={content.blocks ?? []}
            onActiveBlockChange={setActiveAudioBlockId}
            onAutoAdvance={handleAutoAdvance}
            showAutoRead={content.type === 'novel'}
            onAudioSeekerReady={setAudioBlockSeeker}
            onAudioTimelineChange={setAudioTimestamps}
            visible={readerHeaderVisible}
            floating={readerHeaderFloating}
            onInteraction={keepReaderHeaderVisible}
          />

          <div className="border-t border-border">
            {content.type === 'manga' ? (
              <EpisodeImageReader workTitle={content.work.title} images={content.images ?? []} />
            ) : (
              <>
                <EpisodeContentReader
                  workTitle={content.work.title}
                  blocks={content.blocks ?? []}
                  settings={settings}
                  activeBlockId={activeAudioBlockId}
                  onAudioBlockSelect={autoReadSeekEnabled ? seekAudioToBlock : undefined}
                  audioTimestamps={audioTimestamps}
                />
              </>
            )}
          </div>

          <EpisodeBottomNav episodes={episodes} currentEpNo={epNo} onNavigate={handleNavigateToEpisode} />
        </div>

        <div className="mt-6">
          <EpisodeSelectDropdown episodes={episodes} currentEpNo={epNo} onNavigate={handleNavigateToEpisode} />
        </div>
      </div>

      <EpisodeCommentsSection
        workUuid={workUuid}
        epNo={epNo}
        readerMessage={content.episode.reader_message}
        comments={episodeComments}
        page={commentPage}
        totalPages={commentTotalPages}
        onPageChange={setCommentPage}
        onCommentPosted={() => refetchComments()}
      />

      {/* modal ยืนยันซื้อ (สำหรับ pendingTarget ที่ไม่ใช่ตอนปัจจุบัน เช่นกด "ตอนถัดไป" ไปตอนล็อก
          — เคส "ตอนปัจจุบันเองต้องซื้อ" อยู่ใน branch error ด้านบนแยกต่างหากแล้ว) */}
      {pendingTargetMeta && pendingTargetMeta.ep_no !== epNo && (
        <PurchaseConfirmDialog
          open={purchaseDialogOpen}
          workTitle={work?.title ?? ''}
          epNo={pendingTargetMeta.ep_no}
          epLabel={pendingTargetMeta.episode_label}
          epName={pendingTargetMeta.ep_name}
          price={Number(pendingTargetMeta.ep_price)}
          busy={purchaseBusy}
          error={purchaseError}
          onConfirm={(skip) => {
            if (skip) skipFor7Days()
            attemptPurchase(pendingTargetMeta)
          }}
          onCancel={() => {
            setPurchaseDialogOpen(false)
            setPendingTargetEpNo(null)
          }}
        />
      )}
    </div>
  )
}
