'use client'

import { useCallback, useRef } from 'react'
import { Volume2 } from 'lucide-react'
import type { NovelBlock, NovelBlockAudioTs } from '@/types'

export interface EpisodeAudio {
  variants: EpisodeAudioVariant[]
}

export interface EpisodeAudioVariant {
  slot: 'old_male' | 'young_male' | 'female' | 'pro'
  label: string
  version: string
  url: string
  duration_seconds: number
  timestamps: Record<string, NovelBlockAudioTs>
}

export function EpisodeAudioPlayer({
  audio,
  blocks,
  onActiveBlockChange,
}: {
  audio: EpisodeAudio
  blocks: NovelBlock[]
  onActiveBlockChange: (blockId: string | null) => void
}) {
  const lastBlockId = useRef<string | null>(null)
  const defaultVariant = audio.variants[0]

  const updateActiveBlock = useCallback((currentTime: number) => {
    const active = blocks.find((block) => {
      const timestamp = defaultVariant.timestamps[block.id]
      return timestamp !== null && currentTime >= timestamp.start && currentTime < timestamp.end
    })
    const nextBlockId = active?.id ?? null
    if (nextBlockId !== lastBlockId.current) {
      lastBlockId.current = nextBlockId
      onActiveBlockChange(nextBlockId)
    }
  }, [blocks, onActiveBlockChange])

  if (!defaultVariant) return null

  return (
    <section className="border-t border-border bg-muted/20 px-6 py-4 sm:px-10" aria-label="เสียงบรรยาย">
      <div className="mx-auto flex max-w-[720px] items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Volume2 className="size-4" aria-hidden="true" />
        </div>
        <audio
          className="h-10 min-w-0 flex-1"
          controls
          preload="metadata"
          src={defaultVariant.url}
          onTimeUpdate={(event) => updateActiveBlock(event.currentTarget.currentTime)}
          onSeeked={(event) => updateActiveBlock(event.currentTarget.currentTime)}
          onEnded={() => onActiveBlockChange(null)}
        >
          เบราว์เซอร์นี้ไม่รองรับการเล่นเสียง
        </audio>
      </div>
    </section>
  )
}
