'use client'

import { useEffect, useState } from 'react'
import { Check, CircleAlert, LoaderCircle, Volume2, X } from 'lucide-react'
import { api } from '@/lib/api'

export type TtsStatus = 'pending' | 'processing' | 'done' | 'failed' | 'cancelled' | null

type TtsJob = {
  id: string
  status: Exclude<TtsStatus, null>
  total_blocks: number
  completed_blocks: number
  current_block: number | null
}

type TtsJobResponse = { success: boolean; data: TtsJob | null }

const STATUS = {
  pending: { label: 'รอคิวสร้างเสียง', className: 'text-amber-600', icon: LoaderCircle },
  processing: { label: 'กำลังสร้างเสียง', className: 'text-primary', icon: LoaderCircle },
  done: { label: 'เสียงพร้อม', className: 'text-teal-600', icon: Check },
  failed: { label: 'สร้างเสียงไม่สำเร็จ', className: 'text-destructive', icon: CircleAlert },
  cancelled: { label: 'ต้องสร้างเสียงใหม่', className: 'text-muted-foreground', icon: Volume2 },
} as const

export function EpisodeTtsControl({
  epId,
  status,
  onChanged,
}: {
  epId: string
  status: TtsStatus
  onChanged: () => void
}) {
  const [job, setJob] = useState<TtsJob | null>(null)
  const [busy, setBusy] = useState(false)
  const currentStatus = job?.status ?? status
  const active = currentStatus === 'pending' || currentStatus === 'processing'

  useEffect(() => {
    let disposed = false

    async function refreshJob() {
      try {
        const response = await api.get<TtsJobResponse>(`/writer/episodes/${epId}/tts-jobs/latest`)
        if (!disposed) setJob(response.data)
      } catch {
        // The page-level refresh still exposes API failures; polling must not
        // replace a usable writer page with a transient toast every five seconds.
      }
    }

    void refreshJob()
    if (!active) return () => { disposed = true }
    const timer = window.setInterval(() => void refreshJob(), 5_000)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [active, epId])

  async function requestAudio() {
    if (busy || active) return
    setBusy(true)
    try {
      const response = await api.post<{ success: boolean; data: { created: boolean; job: TtsJob } }>(
        `/writer/episodes/${epId}/tts-jobs`,
      )
      setJob(response.data.job)
      onChanged()
    } catch (error: any) {
    } finally {
      setBusy(false)
    }
  }

  async function cancelAudio() {
    if (busy || !active) return
    setBusy(true)
    try {
      const response = await api.delete<{ success: boolean; data: { cancelled: boolean; job: TtsJob | null } }>(
        `/writer/episodes/${epId}/tts-jobs/latest`,
      )
      setJob(response.data.job)
      onChanged()
    } catch (error: any) {
    } finally {
      setBusy(false)
    }
  }

  if (currentStatus) {
    const item = STATUS[currentStatus]
    const Icon = item.icon
    const progress = active && job && job.total_blocks > 0
      ? ` ${job.completed_blocks}/${job.total_blocks} ย่อหน้า`
      : ''

    return (
      <span className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-xs font-medium">
        <button
          type="button"
          onClick={requestAudio}
          disabled={busy || active}
          title={`${item.label}${progress}`}
          className={`inline-flex items-center gap-1 ${item.className} disabled:cursor-default`}
        >
          <Icon className={`size-3.5 ${active || busy ? 'animate-spin' : ''}`} />
          {item.label}{progress}
        </button>
        {active && (
          <button
            type="button"
            onClick={cancelAudio}
            disabled={busy}
            title="ยกเลิกงานสร้างเสียง"
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-60"
          >
            <X className="size-3.5" />
          </button>
        )}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={requestAudio}
      disabled={busy}
      className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-primary hover:underline disabled:opacity-60"
    >
      <Volume2 className={`size-3.5 ${busy ? 'animate-pulse' : ''}`} />
      {busy ? 'กำลังส่งคิว...' : 'สร้างเสียง'}
    </button>
  )
}
