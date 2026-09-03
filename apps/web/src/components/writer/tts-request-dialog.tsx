'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Sparkles, Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import type { WriterEpisodeRow } from './episode-list-table'

type TtsTier = 'basic' | 'pro'
type BasicVoicePreview = {
  slot: 'old_male' | 'young_male' | 'female'
  label: string
  preview_url: string
}
type TtsRequestSubmission = {
  created: boolean
  request: {
    id: string
    tier: TtsTier
    status: 'approval' | 'queued' | 'processing'
  }
}

function requestStatusLabel(status: TtsRequestSubmission['request']['status']) {
  if (status === 'approval') return 'รอผู้ดูแลอนุมัติ'
  if (status === 'queued') return 'อยู่ในคิวสร้างเสียง'
  return 'กำลังสร้างเสียง'
}

// These generated WAVs are committed with the web app, not uploaded to R2.
// TTSCore's `readji-tts-basic-preview` derives each one from the matching
// private Basic_<slot>.wav reference file.
const BASIC_VOICE_PREVIEWS: BasicVoicePreview[] = [
  { slot: 'old_male', label: 'ชายแก่', preview_url: '/audio/tts-samples/basic/old_male.wav' },
  { slot: 'young_male', label: 'หนุ่มน้อย', preview_url: '/audio/tts-samples/basic/young_male.wav' },
  { slot: 'female', label: 'คุณผู้หญิง', preview_url: '/audio/tts-samples/basic/female.wav' },
]

export function TtsRequestDialog({
  workUuid,
  episodes,
  selectedEpisodeIds,
  onSubmitted,
  trigger,
}: {
  workUuid: string
  episodes: WriterEpisodeRow[]
  selectedEpisodeIds: string[]
  onSubmitted: () => void
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [tier, setTier] = useState<TtsTier>('basic')
  const [episodeIds, setEpisodeIds] = useState<Set<string>>(new Set())
  const [playingSlot, setPlayingSlot] = useState<BasicVoicePreview['slot'] | null>(null)
  const [saving, setSaving] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  function stopPreview() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    setPlayingSlot(null)
  }

  useEffect(() => {
    if (!open) {
      stopPreview()
      return
    }

    setEpisodeIds(new Set(selectedEpisodeIds))
    setTier('basic')

    return () => {
      stopPreview()
    }
    // Capture the table selection exactly when this dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function playPreview(voice: BasicVoicePreview) {
    if (playingSlot === voice.slot) {
      stopPreview()
      return
    }

    stopPreview()
    const audio = new Audio(voice.preview_url)
    audioRef.current = audio
    audio.onended = () => {
      if (audioRef.current === audio) audioRef.current = null
      setPlayingSlot(null)
    }
    audio.onerror = () => {
      if (audioRef.current === audio) audioRef.current = null
      setPlayingSlot(null)
      toast.error('ไม่พบไฟล์ตัวอย่างเสียงในเว็บ โปรดเจน Basic preview แล้ว deploy เว็บอีกครั้ง')
    }
    audio.play().then(() => setPlayingSlot(voice.slot)).catch(() => {
      if (audioRef.current === audio) audioRef.current = null
      setPlayingSlot(null)
      toast.error('ไม่สามารถเล่นไฟล์ตัวอย่างเสียงได้')
    })
  }

  function selectTier(nextTier: TtsTier) {
    stopPreview()
    setTier(nextTier)
  }

  function toggleEpisode(id: string) {
    setEpisodeIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setEpisodeIds(new Set(episodes.map((episode) => episode.ep_id)))
  }

  async function submit() {
    if (episodeIds.size === 0) {
      toast.error('เลือกอย่างน้อยหนึ่งตอนก่อนส่งคำขอ')
      return
    }
    setSaving(true)
    try {
      const result = await api.post<{ data: TtsRequestSubmission }>(`/writer/works/${workUuid}/tts-requests`, {
        episode_ids: [...episodeIds],
        tier,
      })
      if (result.data.created) {
        toast.success(
          tier === 'basic'
            ? `ส่งคำขอ Basic TTS แล้ว · คำขอ #${result.data.request.id} รอผู้ดูแลอนุมัติ`
            : `ส่งคำขอ Pro TTS แล้ว · คำขอ #${result.data.request.id} รอผู้ดูแลอนุมัติ`,
        )
      } else {
        toast.info(`ไม่ได้ส่งคำขอซ้ำ · คำขอ #${result.data.request.id} ${requestStatusLabel(result.data.request.status)} อยู่แล้ว`)
      }
      setOpen(false)
      onSubmitted()
    } catch (error: any) {
      toast.error(error?.message ?? 'ส่งคำขอใช้เสียงบรรยายไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[min(46rem,calc(100vh-2rem))] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-5 pr-12">
          <DialogTitle className="flex items-center gap-2"><Volume2 className="size-5 text-amber-600" /> เสียงบรรยายอัตโนมัติ</DialogTitle>
          <DialogDescription>ส่งคำขอเพื่อให้ผู้ดูแลตรวจสอบก่อนเริ่มสร้างเสียงจริง</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 rounded-xl bg-muted p-1" role="tablist" aria-label="ระดับ TTS">
            <button
              type="button"
              role="tab"
              aria-selected={tier === 'basic'}
              onClick={() => selectTier('basic')}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${tier === 'basic' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Basic TTS
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tier === 'pro'}
              onClick={() => selectTier('pro')}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${tier === 'pro' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Pro TTS
            </button>
          </div>

          {tier === 'basic' ? (
            <section className="rounded-xl border border-amber-500/25 bg-amber-50/60 p-4 dark:bg-amber-950/20">
              <p className="font-medium text-foreground">Basic TTS — เสียงบรรยายเดียวต่อหนึ่งไฟล์</p>
              <p className="mt-1 text-sm text-muted-foreground">เมื่ออนุมัติ ระบบจะสร้างทั้ง 3 เวอร์ชันจากไฟล์จริงในโฟลเดอร์ Basic เพื่อให้ผู้อ่านเลือกเสียงเองในแถบอ่านอัตโนมัติ</p>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {BASIC_VOICE_PREVIEWS.map((voice) => {
                  const playing = playingSlot === voice.slot
                  return (
                    <button
                      key={voice.slot}
                      type="button"
                      onClick={() => playPreview(voice)}
                      className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-amber-100/50 dark:hover:bg-amber-950/40"
                    >
                      <span className="font-medium">{voice.label}</span>
                      {playing ? <Pause className="size-4 shrink-0" /> : <Play className="size-4 shrink-0" />}
                    </button>
                  )
                })}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">ปุ่มนี้เล่นไฟล์เดโมที่ TTSCore เจนจาก Basic voice ต้นแบบ แล้วบรรจุไว้กับเว็บโดยตรง</p>
            </section>
          ) : (
            <section className="rounded-xl border border-violet-500/25 bg-violet-50/60 p-4 dark:bg-violet-950/20">
              <p className="flex items-center gap-2 font-medium text-foreground"><Sparkles className="size-4 text-violet-600" /> Pro TTS — หลายเสียงตามตัวละคร</p>
              <p className="mt-1 text-sm text-muted-foreground">คำขอจะถูกเก็บเป็น Pro เพื่อให้ผู้ดูแลพิจารณา แต่ worker หลายเสียงยังอยู่ระหว่างเชื่อมต่อ จึงยังไม่เริ่มสร้างเสียงแทน Basic โดยอัตโนมัติ</p>
              <p className="mt-3 text-xs text-muted-foreground">เมื่อเปิดใช้งานแล้ว Pro จะใช้คำสั่ง เช่น <code>//ชื่อ</code> ใน TTS Editor เพื่อสลับเสียงตามตัวละครในไฟล์เดียว</p>
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">ตอนที่ต้องการส่งขอ</p>
                <p className="text-xs text-muted-foreground">เลือกเฉพาะตอน หรือใช้ทั้งหมดได้</p>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={selectAll}>เลือกทั้งหมด</Button>
            </div>
            <div className="max-h-52 divide-y overflow-y-auto rounded-lg border">
              {episodes.map((episode) => (
                <label key={episode.ep_id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                  <Checkbox checked={episodeIds.has(episode.ep_id)} onCheckedChange={() => toggleEpisode(episode.ep_id)} />
                  <span className="min-w-0 flex-1 truncate text-sm">ตอนที่ {episode.ep_no} · {episode.ep_name}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">เลือกแล้ว {episodeIds.size} จาก {episodes.length} ตอน</p>
          </section>
        </div>

        <DialogFooter className="px-5">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>ยกเลิก</Button>
          <Button type="button" onClick={submit} disabled={saving || episodeIds.size === 0} className="bg-amber-600 text-white hover:bg-amber-700">
            {saving ? 'กำลังส่งคำขอ...' : `ยืนยันขอ ${tier === 'basic' ? 'Basic' : 'Pro'} TTS`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
