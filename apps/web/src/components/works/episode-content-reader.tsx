'use client'

import { notoSerifThai, notoSansThai, sriracha } from '@/lib/fonts'
import { cn } from '@/lib/utils'
import { normalizeStoredNovelBlock } from '@/lib/novel-blocks'
import { READING_THEMES, type ReadingSettings } from '@/lib/reading-settings'
import type { NovelBlock, NovelBlockAudioTs } from '@/types'

const FONT_CLASS_NAME = {
  serif: notoSerifThai.className,
  sans: notoSansThai.className,
  handwriting: sriracha.className,
}

// ระยะห่างย่อหน้า = จำนวนบรรทัดเพิ่มจากค่า lineHeight ปกติ (2 = เว้นเพิ่มอีก 2 บรรทัด)
const PARAGRAPH_SPACING_MULTIPLIER = 2

export function EpisodeContentReader({
  workTitle,
  blocks,
  settings,
  activeBlockId,
  onAudioBlockSelect,
  audioTimestamps,
}: {
  workTitle: string
  blocks: NovelBlock[]
  settings: ReadingSettings
  activeBlockId?: string | null
  onAudioBlockSelect?: (blockId: string) => void
  audioTimestamps?: Record<string, NovelBlockAudioTs> | null
}) {
  const fontClassName = FONT_CLASS_NAME[settings.fontFamily]
  const theme = READING_THEMES[settings.theme]
  // ระยะห่างย่อหน้าต้องเห็นชัดกว่าระยะห่างบรรทัดในย่อหน้าเดียวกันเสมอ ไม่งั้นตาแยกไม่ออกว่า
  // ขึ้นย่อหน้าใหม่ หรือแค่บรรทัดตัดขึ้นเอง — ผูกกับ fontSize/lineHeight ของ user ไว้ (คูณด้วย
  // PARAGRAPH_SPACING_MULTIPLIER) แทนที่จะ hardcode ค่าคงที่แบบเดิม (mb-5 เดิมไม่ขยับตาม
  // lineHeight เลย ต่อให้ปรับ slider ไปสุดที่ 2.4 ระยะห่างย่อหน้าก็ยังเท่าเดิม)
  const paragraphGap = settings.fontSize * settings.lineHeight * PARAGRAPH_SPACING_MULTIPLIER

  // ของเก่าใน DB ที่ยังไม่เคย resave ตั้งแต่ 2026-08-16 จะยังมี key เดิม (label/tts.kind) — normalize
  // ก่อนใช้เสมอ ไม่งั้น block.display_label จะเป็น undefined สำหรับตอนเก่าที่ยังไม่ได้แก้ผ่าน editor เลย
  const normalizedBlocks = blocks.map(normalizeStoredNovelBlock)

  // บล็อกคำสั่ง TTS ล้วนๆ (block_kind:'gap' จาก shortcut //1-//4 เว้นจังหวะ — ไม่มีเนื้อหาจริงให้อ่าน
  // แค่สั่งเว้นช่วงตอนเล่นเสียง) ไม่ควรโผล่เป็นย่อหน้าว่างเปล่าในหน้าอ่านของผู้อ่านทั่วไป — กรองออกก่อน
  // render เสมอ (บั๊กจริงที่เจอจาก audit หลัง Codex ทำระบบ TTS Tier 1 — ดู KNOWN_ISSUES.md) ไม่กรอง
  // block ที่แค่ tts.skip=true เพราะนั่นแปลว่า "ข้ามตอนสร้างเสียง" เท่านั้น เนื้อหาจริงยังอ่านได้ปกติ
  const visibleBlocks = normalizedBlocks.filter((block) => block.tts?.block_kind !== 'gap' && block.text !== '')

  return (
    <div
      data-reader-content
      className="px-4 py-6 transition-colors duration-200 sm:px-16 sm:py-12"
      style={theme.background ? { backgroundColor: theme.background } : undefined}
    >
      <p
        className={cn('mb-8 text-center text-xs', !theme.text && 'text-muted-foreground/60')}
        style={theme.text ? { color: theme.text, opacity: 0.6 } : undefined}
      >
        เรื่อง: {workTitle}
      </p>

      <div
        className={cn('mx-auto max-w-[720px] select-none', !theme.text && 'text-foreground', fontClassName)}
        style={{ fontSize: settings.fontSize, lineHeight: settings.lineHeight, color: theme.text ?? undefined }}
        onCopy={(e) => e.preventDefault()}
      >
        {visibleBlocks.map((block, i) => {
          const isDialogue = block.display_label.startsWith('dialogue')
          const isLast = i === visibleBlocks.length - 1
          const canSeekAudio = Boolean(onAudioBlockSelect && audioTimestamps?.[block.id])
          return (
            <p
              key={block.id}
              data-audio-block-id={block.id}
              data-audio-seek={canSeekAudio || undefined}
              role={canSeekAudio ? 'button' : undefined}
              tabIndex={canSeekAudio ? 0 : undefined}
              aria-label={canSeekAudio ? 'เริ่มอ่านอัตโนมัติจากย่อหน้านี้' : undefined}
              onClick={canSeekAudio ? () => onAudioBlockSelect?.(block.id) : undefined}
              onKeyDown={canSeekAudio ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onAudioBlockSelect?.(block.id)
                }
              } : undefined}
              className={cn(
                'rounded-md transition-colors duration-150',
                !isDialogue && 'indent-[2em]',
                canSeekAudio && 'cursor-pointer hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                activeBlockId === block.id && 'bg-primary/10 ring-1 ring-primary/20',
              )}
              style={{ marginBottom: isLast ? 0 : paragraphGap }}
            >
              {block.text}
            </p>
          )
        })}
      </div>
    </div>
  )
}
