'use client'

import { ListOrdered, LockKeyhole } from 'lucide-react'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { PublicReaderChapter } from '@/interface/content.interface'
import { cn } from '@/lib/utils'
import { formatChapterNumber } from '@/utils/chapter-number.util'

export function ChapterTocDialog({
  chapters,
  currentChapterNumber,
  onNavigate,
}: {
  chapters: PublicReaderChapter[]
  currentChapterNumber: string
  onNavigate: (chapter: PublicReaderChapter) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="เปิดสารบัญ"
          className="readji-icon-button flex size-9 cursor-pointer items-center justify-center"
        >
          <ListOrdered className="size-5" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border px-5 py-5 pr-12">
          <DialogTitle className="text-lg font-extrabold">สารบัญ</DialogTitle>
          <DialogDescription>{chapters.length.toLocaleString('th-TH')} ตอน</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto p-2">
          {chapters.map((chapter) => {
            const active = chapter.chapter_number === currentChapterNumber
            return (
              <button
                key={chapter.id}
                type="button"
                onClick={() => {
                  setOpen(false)
                  onNavigate(chapter)
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                  active ? 'bg-primary/10 text-primary' : 'hover:bg-accent',
                )}
              >
                <span className="flex min-w-10 justify-center rounded-lg bg-secondary px-2 py-1.5 text-xs font-extrabold text-secondary-foreground">
                  {formatChapterNumber(chapter.chapter_number)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{chapter.title}</span>
                {!chapter.can_read ? (
                  <LockKeyhole className="size-4 shrink-0 text-muted-foreground" aria-label="ตอนที่ยังไม่ได้ซื้อ" />
                ) : null}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
