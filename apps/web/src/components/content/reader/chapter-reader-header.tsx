'use client'

import { Home } from 'lucide-react'
import Link from 'next/link'
import { ShareButtons } from '@/components/common/share-buttons'
import type { PublicReaderChapter } from '@/interface/content.interface'
import type { ReadingSettings } from '@/lib/reading-settings'
import { ChapterTocDialog } from './chapter-toc-dialog'
import { ReadingSettingsMenu } from './reading-settings-menu'

function formatChapterNumber(value: string) {
  return Number(value).toLocaleString('th-TH', { maximumFractionDigits: 1 })
}

export function ChapterReaderHeader({
  slug,
  chapterNumber,
  chapterTitle,
  chapters,
  showReadingSettings,
  settings,
  onSettingsChange,
  onNavigate,
}: {
  slug: string
  chapterNumber: string
  chapterTitle: string
  chapters: PublicReaderChapter[]
  showReadingSettings: boolean
  settings: ReadingSettings
  onSettingsChange: (settings: ReadingSettings) => void
  onNavigate: (chapter: PublicReaderChapter) => void
}) {
  return (
    <header className="sticky top-[4.35rem] z-40 flex items-center justify-between gap-3 border-b border-border/70 bg-card/95 px-3 py-3 shadow-sm backdrop-blur-xl sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href={`/content/${encodeURIComponent(slug)}`}
          aria-label="กลับหน้ารายละเอียดเรื่อง"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/85"
        >
          <Home className="size-4" aria-hidden="true" />
        </Link>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">
            ตอนที่ {formatChapterNumber(chapterNumber)}
          </p>
          <h1 className="truncate text-sm font-extrabold text-foreground sm:text-lg">
            {chapterTitle}
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <ChapterTocDialog
          chapters={chapters}
          currentChapterNumber={chapterNumber}
          onNavigate={onNavigate}
        />
        {showReadingSettings ? (
          <ReadingSettingsMenu settings={settings} onChange={onSettingsChange} />
        ) : null}
        <ShareButtons title={chapterTitle} iconOnly />
      </div>
    </header>
  )
}
