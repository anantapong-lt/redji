'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pause, Play, RotateCcw, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import type { NovelBlock, NovelBlockAudioTs } from '@/types'
import type { EpisodeAudio, EpisodeAudioVariant } from './episode-audio-player'

function positionKey(workUuid: string, epNo: number, slot: EpisodeAudioVariant['slot']) {
  return `readji:auto-read:position:${workUuid}:${epNo}:${slot}`
}

function continuationKey(workUuid: string) {
  return `readji:auto-read:continue:${workUuid}`
}

type AutoReadContinuation = { ep_no: number; voice_slot?: EpisodeAudioVariant['slot'] }

function readContinuation(workUuid: string): AutoReadContinuation | null {
  const value = window.sessionStorage.getItem(continuationKey(workUuid))
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as AutoReadContinuation
    return Number.isInteger(parsed.ep_no) ? parsed : null
  } catch {
    const epNo = Number(value)
    return Number.isInteger(epNo) ? { ep_no: epNo } : null
  }
}

function clock(value: number) {
  const seconds = Math.max(0, Math.floor(value))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export function EpisodeAutoReadDialog({
  workUuid,
  epNo,
  audio,
  blocks,
  onActiveBlockChange,
  onAutoAdvance,
  onAudioSeekerReady,
  onAudioTimelineChange,
}: {
  workUuid: string
  epNo: number
  audio: EpisodeAudio | null | undefined
  blocks: NovelBlock[]
  onActiveBlockChange: (blockId: string | null) => void
  onAutoAdvance: (settings: { autoPurchase: boolean; voiceSlot: EpisodeAudioVariant['slot'] }) => void | Promise<void>
  onAudioSeekerReady?: (seeker: ((blockId: string) => void) | null) => void
  onAudioTimelineChange?: (timestamps: Record<string, NovelBlockAudioTs> | null) => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const token = useAuthStore((state) => state.token)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [open, setOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<EpisodeAudioVariant['slot']>('old_male')
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [autoNext, setAutoNext] = useState(false)
  const [autoPurchase, setAutoPurchase] = useState(false)
  const [resumePlayback, setResumePlayback] = useState(false)
  const [autoReadModeActive, setAutoReadModeActive] = useState(false)
  const [miniPlayerVisible, setMiniPlayerVisible] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [waitingForAudio, setWaitingForAudio] = useState(false)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)

  const variantsBySlot = useMemo(() => new Map(audio?.variants.map((variant) => [variant.slot, variant])), [audio?.variants])
  const selectedAudio = variantsBySlot.get(selectedSlot) ?? audio?.variants[0] ?? null

  const updateActiveBlock = useCallback((time: number) => {
    const active = blocks.find((block) => {
      const timestamp = selectedAudio?.timestamps[block.id]
      return timestamp !== undefined && time >= timestamp.start && time < timestamp.end
    })
    onActiveBlockChange(active?.id ?? null)
  }, [blocks, onActiveBlockChange, selectedAudio])

  useEffect(() => {
    onAudioTimelineChange?.(selectedAudio?.timestamps ?? null)
    return () => onAudioTimelineChange?.(null)
  }, [onAudioTimelineChange, selectedAudio])

  useEffect(() => {
    if (variantsBySlot.has(selectedSlot) || !audio?.variants[0]) return
    setSelectedSlot(audio.variants[0].slot)
  }, [audio?.variants, selectedSlot, variantsBySlot])

  // A reader can ask for a newly published episode after this page is already
  // open.  Once the work is TTS-enabled that request goes straight to the
  // worker queue, so refetch the active episode until its finished Basic audio
  // appears instead of making the reader reload the whole page by hand.
  useEffect(() => {
    if (selectedAudio) {
      setWaitingForAudio(false)
      return
    }
    if (!waitingForAudio) return

    let attempts = 0
    const interval = window.setInterval(() => {
      attempts += 1
      if (attempts > 60) {
        window.clearInterval(interval)
        setWaitingForAudio(false)
        return
      }
      void queryClient.invalidateQueries({ queryKey: ['works', workUuid, 'episodes', epNo, 'read'] })
    }, 15_000)
    return () => window.clearInterval(interval)
  }, [epNo, queryClient, selectedAudio, waitingForAudio, workUuid])

  useEffect(() => {
    let active = true
    setPreferencesLoaded(false)
    if (!token) {
      setAutoNext(false)
      setAutoPurchase(false)
      setPreferencesLoaded(true)
      return () => { active = false }
    }
    void api.get<{ data: { auto_next: boolean; auto_purchase: boolean } }>(`/works/${workUuid}/auto-read-preferences`)
      .then((result) => {
        if (!active) return
        setAutoNext(result.data.auto_next)
        setAutoPurchase(result.data.auto_next && result.data.auto_purchase)
        setPreferencesLoaded(true)
      })
      .catch(() => {
        if (active) {
          setPreferencesLoaded(true)
        }
      })
    return () => { active = false }
  }, [token, workUuid])

  useEffect(() => {
    const continuation = readContinuation(workUuid)
    if (continuation?.ep_no !== epNo) return
    window.sessionStorage.removeItem(continuationKey(workUuid))
    if (continuation.voice_slot) setSelectedSlot(continuation.voice_slot)
    setOpen(true)
    setResumePlayback(true)
  }, [epNo, workUuid])

  useEffect(() => {
    setAutoReadModeActive(false)
    setMiniPlayerVisible(false)
  }, [epNo])

  useEffect(() => () => {
    audioRef.current?.pause()
    setPlaying(false)
    onActiveBlockChange(null)
  }, [onActiveBlockChange])

  function selectVoice(slot: EpisodeAudioVariant['slot']) {
    if (!variantsBySlot.has(slot)) return
    audioRef.current?.pause()
    onActiveBlockChange(null)
    setSelectedSlot(slot)
  }

  function restorePosition(player: HTMLAudioElement) {
    if (!selectedAudio) return
    player.playbackRate = speed
    setDuration(player.duration || selectedAudio.duration_seconds)
    const saved = Number(window.localStorage.getItem(positionKey(workUuid, epNo, selectedAudio.slot)))
    if (Number.isFinite(saved) && saved > 0 && saved < player.duration) {
      player.currentTime = saved
      setCurrentTime(saved)
      // Keep the resume point without making a dormant reader look like a
      // clickable/active audio chunk. Highlighting begins only when the
      // reader explicitly starts auto-read (or resumes the next episode).
      if (autoReadModeActive || resumePlayback) updateActiveBlock(saved)
    } else {
      setCurrentTime(0)
    }
    if (resumePlayback) {
      player.play().then(() => {
        setAutoReadModeActive(true)
        setMiniPlayerVisible(true)
      }).catch(() => {})
      setResumePlayback(false)
    }
  }

  function togglePlay() {
    const player = audioRef.current
    if (!player) return
    if (player.paused) {
      player.play().then(() => setPlaying(true)).catch(() => {})
    } else {
      player.pause()
      setPlaying(false)
    }
  }

  function startReading() {
    const player = audioRef.current
    if (!player) return
    // The primary CTA always starts a new reading session. The saved position
    // remains available for the small player controls, but never turns this
    // explicit "start" action into a resume.
    player.currentTime = 0
    setCurrentTime(0)
    onActiveBlockChange(null)
    if (selectedAudio) window.localStorage.removeItem(positionKey(workUuid, epNo, selectedAudio.slot))
    player.play().then(() => {
      setPlaying(true)
      setAutoReadModeActive(true)
      setMiniPlayerVisible(true)
      setOpen(false)
    }).catch(() => {})
  }

  function seek(value: number) {
    const player = audioRef.current
    if (!player) return
    player.currentTime = value
    setCurrentTime(value)
    updateActiveBlock(value)
  }

  const seekAndReadBlock = useCallback((blockId: string) => {
    if (!autoReadModeActive) return
    const timestamp = selectedAudio?.timestamps[blockId]
    const player = audioRef.current
    if (!timestamp || !player) return

    player.currentTime = timestamp.start
    setCurrentTime(timestamp.start)
    updateActiveBlock(timestamp.start)
    player.play().then(() => {
      setPlaying(true)
      setMiniPlayerVisible(true)
      setOpen(false)
    }).catch(() => {})
  }, [autoReadModeActive, selectedAudio, updateActiveBlock])

  useEffect(() => {
    onAudioSeekerReady?.(selectedAudio && autoReadModeActive ? seekAndReadBlock : null)
    return () => onAudioSeekerReady?.(null)
  }, [autoReadModeActive, onAudioSeekerReady, seekAndReadBlock, selectedAudio])

  function stopAutoReadMode() {
    audioRef.current?.pause()
    setPlaying(false)
    setAutoReadModeActive(false)
    setMiniPlayerVisible(false)
    onActiveBlockChange(null)
    setOpen(false)
  }

  function reset() {
    seek(0)
    audioRef.current?.pause()
    setPlaying(false)
  }

  function changeSpeed(value: number) {
    setSpeed(value)
    if (audioRef.current) audioRef.current.playbackRate = value
  }

  async function savePreferences(nextAutoNext: boolean, nextAutoPurchase: boolean) {
    if (!token) return true
    setSavingPreferences(true)
    try {
      await api.put(`/works/${workUuid}/auto-read-preferences`, {
        auto_next: nextAutoNext,
        auto_purchase: nextAutoPurchase,
      })
      return true
    } catch (error: any) {
      return false
    } finally {
      setSavingPreferences(false)
    }
  }

  function toggleAutoNext(next: boolean) {
    const previous = { autoNext, autoPurchase }
    const nextAutoPurchase = next && autoPurchase
    setAutoNext(next)
    setAutoPurchase(nextAutoPurchase)
    void savePreferences(next, nextAutoPurchase).then((saved) => {
      if (!saved) {
        setAutoNext(previous.autoNext)
        setAutoPurchase(previous.autoPurchase)
      }
    })
  }

  function toggleAutoPurchase(next: boolean) {
    const previous = { autoNext, autoPurchase }
    setAutoPurchase(next)
    void savePreferences(autoNext, next).then((saved) => {
      if (!saved) {
        setAutoNext(previous.autoNext)
        setAutoPurchase(previous.autoPurchase)
      }
    })
  }

  async function requestTts() {
    if (!token) {
      router.push('/login')
      return
    }
    setRequesting(true)
    try {
      const result = await api.post<{ data: { created?: boolean; queued?: boolean } }>(`/works/${workUuid}/episodes/${epNo}/tts-requests`)
      if (result.data.queued) {
        setWaitingForAudio(true)
      } else if (result.data.created) {
      } else {
      }
      setOpen(false)
    } catch (error: any) {
    } finally {
      setRequesting(false)
    }
  }

  return (
    <>
      {selectedAudio && (
        <audio
          key={selectedAudio.url}
          ref={audioRef}
          className="sr-only"
          preload="metadata"
          src={selectedAudio.url}
          onLoadedMetadata={(event) => restorePosition(event.currentTarget)}
          onTimeUpdate={(event) => {
            const time = event.currentTarget.currentTime
            setCurrentTime(time)
            window.localStorage.setItem(positionKey(workUuid, epNo, selectedAudio.slot), String(time))
            if (autoReadModeActive) updateActiveBlock(time)
          }}
          onSeeked={(event) => {
            if (autoReadModeActive) updateActiveBlock(event.currentTarget.currentTime)
          }}
          onPlay={(event) => {
            // Playing from any control is an explicit reader action. It turns
            // on auto-read even when the user used the compact player instead
            // of the large CTA.
            setPlaying(true)
            setAutoReadModeActive(true)
            setMiniPlayerVisible(true)
            updateActiveBlock(event.currentTarget.currentTime)
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            window.localStorage.removeItem(positionKey(workUuid, epNo, selectedAudio.slot))
            setPlaying(false)
            setMiniPlayerVisible(false)
            onActiveBlockChange(null)
            if (autoNext) void onAutoAdvance({ autoPurchase, voiceSlot: selectedAudio.slot })
          }}
        >
          เบราว์เซอร์นี้ไม่รองรับการเล่นเสียง
        </audio>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(true)} className="flex size-9 shrink-0 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground sm:size-auto sm:flex-col sm:gap-1" aria-label="อ่านอัตโนมัติ" aria-expanded={open}>
        <Volume2 className="size-5" />
        <span className="hidden text-xs sm:block">อ่านอัตโนมัติ</span>
      </button>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Volume2 className="size-5 text-primary" /> อ่านอัตโนมัติ</DialogTitle>
          <DialogDescription>{selectedAudio ? 'เลือกเสียง ปรับความเร็ว และตั้งค่าการไปตอนต่อไป' : 'ขอเสียงบรรยายสำหรับเรื่องนี้เพื่อฟังในภายหลัง'}</DialogDescription>
        </DialogHeader>
        {selectedAudio ? (
          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium">เลือกเสียงบรรยาย</p>
              <div className={`grid gap-2 ${(audio?.variants.length ?? 0) === 1 ? 'grid-cols-1' : 'grid-cols-3'}`}>
                {(audio?.variants ?? []).map((voice) => {
                  const available = true
                  const selected = selectedAudio.slot === voice.slot
                  return (
                    <button
                      key={voice.slot}
                      type="button"
                      disabled={!available}
                      onClick={() => selectVoice(voice.slot)}
                      className={`rounded-lg border px-2 py-2 text-sm transition-colors ${selected ? 'border-primary bg-primary text-primary-foreground' : available ? 'bg-background hover:bg-muted' : 'cursor-not-allowed border-dashed bg-muted/40 text-muted-foreground'}`}
                    >
                      <span className="block font-medium">{voice.label}</span>
                      <span className="block text-[11px] opacity-80">{available ? 'พร้อมฟัง' : 'กำลังเตรียม'}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="mb-3 flex items-center justify-between text-xs tabular-nums text-muted-foreground"><span>{clock(currentTime)}</span><span>{clock(duration)}</span></div>
              <input aria-label="ตำแหน่งเสียง" type="range" min={0} max={duration || 0} step={0.1} value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} className="w-full accent-primary" />
              <div className="mt-4 flex items-center justify-center gap-3">
                <Button type="button" size="icon" variant="ghost" onClick={reset} aria-label="เริ่มใหม่"><RotateCcw className="size-4" /></Button>
                <Button type="button" size="icon-lg" onClick={togglePlay} aria-label={playing ? 'หยุดชั่วคราว' : 'เล่น'}>{playing ? <Pause className="size-5" /> : <Play className="size-5" />}</Button>
                <div className="flex items-center gap-1 rounded-lg border bg-background p-1" aria-label="ความเร็ว">
                  {[0.8, 1, 1.2].map((value) => <button key={value} type="button" onClick={() => changeSpeed(value)} className={`rounded px-1.5 py-1 text-xs ${speed === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{value}×</button>)}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border p-3">
              <label className="flex cursor-pointer items-center justify-between gap-4 text-sm">
                <span><span className="block font-medium">ตอนต่อไปอัตโนมัติ</span><span className="block text-xs text-muted-foreground">เมื่อฟังจบ ระบบจะเปิดตอนถัดไป</span></span>
                <Switch checked={autoNext} disabled={savingPreferences || (!!token && !preferencesLoaded)} onCheckedChange={toggleAutoNext} aria-label="ตอนต่อไปอัตโนมัติ" />
              </label>
              <label className={`flex items-center justify-between gap-4 border-t pt-3 text-sm ${autoNext && token ? 'cursor-pointer' : 'cursor-not-allowed opacity-55'}`}>
                <span><span className="block font-medium">ซื้ออัตโนมัติ</span><span className="block text-xs text-muted-foreground">ใช้เหรียญผ่านระบบซื้อปกติเมื่อพบตอนเสียเงิน</span></span>
                <Switch checked={autoPurchase} disabled={!autoNext || !token || savingPreferences || !preferencesLoaded} onCheckedChange={toggleAutoPurchase} aria-label="ซื้ออัตโนมัติ" />
              </label>
              {!token && <p className="text-xs text-muted-foreground">เข้าสู่ระบบก่อนจึงจะเปิดซื้ออัตโนมัติได้</p>}
            </div>
            <p className="text-center text-xs text-muted-foreground">{autoReadModeActive ? 'กดปิดโหมดเพื่อหยุดเสียง ซ่อนตัวเล่น และปิดการกดย่อหน้า' : 'เมื่อเริ่มอ่านแล้ว กดย่อหน้าในหน้าตอนเพื่อข้ามไปฟังจากตรงนั้นได้'}</p>
            <Button type="button" size="lg" onClick={autoReadModeActive ? stopAutoReadMode : startReading} className="h-12 w-full gap-2 text-base">
              {autoReadModeActive ? <Pause className="size-5" /> : <Play className="size-5" />}
              {autoReadModeActive ? 'ปิดโหมดอ่านอัตโนมัติ' : 'เริ่มอ่านอัตโนมัติ'}
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-5 text-center">
            <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"><Volume2 className="size-5" /></div>
            <p className="mt-3 font-medium">ตอนนี้ยังไม่มีเสียงบรรยาย</p>
            <p className="mt-1 text-sm text-muted-foreground">คำขอจากตอนนี้จะถูกนำไปขอสิทธิ์เสียงให้ทั้งเรื่อง และรอผู้ดูแลอนุมัติ</p>
            <Button type="button" onClick={requestTts} disabled={requesting} className="mt-4 gap-2"><Volume2 className="size-4" />{requesting ? 'กำลังส่งคำขอ...' : 'ขออ่านอัตโนมัติ'}</Button>
          </div>
        )}
      </DialogContent>
      </Dialog>
      {typeof document !== 'undefined' && selectedAudio && miniPlayerVisible && createPortal(
        <button
          type="button"
          onClick={togglePlay}
          className="fixed top-[calc(4.35rem+1rem)] right-4 z-40 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 sm:top-44 sm:right-[max(1.75rem,calc((100vw-1216px)/2+3rem))] sm:size-14"
          aria-label={playing ? 'หยุดอ่านอัตโนมัติชั่วคราว' : 'เล่นอ่านอัตโนมัติต่อ'}
        >
          {playing ? <Pause className="size-6" /> : <Play className="size-6" />}
        </button>,
        document.body,
      )}
    </>
  )
}
