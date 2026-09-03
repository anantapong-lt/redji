'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

interface TagSuggestion {
  name: string
  count: number
}

/**
 * TagAutocompleteInput — หมวดหมู่ย่อยแบบ hashtag (เหมือน TikTok):
 * พิมพ์อะไรก็ตั้งเป็น tag ใหม่ได้เสมอ (free text ล้วนๆ ไม่บังคับเลือกจากลิสต์ที่มีอยู่) แต่
 * ระหว่างพิมพ์จะเห็น tag ที่คนอื่นเคยใช้แล้วพร้อมจำนวนเรื่องที่ใช้ (ข้อมูลจริงจาก GET /tags —
 * คำนวณสดจาก works.tags ไม่มีตาราง tags แยกเพราะตั้งใจให้เป็น free text) — เปิดเป็น popover
 * ที่ใหญ่กว่าแถบเดิมในหน้า (ตามที่ user ขอ เพราะแถบเดิมมันเล็กไปหน่อยสำหรับพิมพ์ค้นหา)
 */
export function TagAutocompleteInput({
  tags,
  onChange,
  maxTags = 10,
  triggerClassName,
  disabled = false,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  maxTags?: number
  triggerClassName?: string
  // 2026-07-30 หน้า /search โหมด "นักเขียน" — แท็กกรองคุณสมบัติของ "เรื่อง" ไม่มีผลตอนค้นหา
  // คนเขียน เลยต้องปิดไว้ (เทาจาง+กดไม่ได้)
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data: suggestions } = useQuery({
    queryKey: ['tags', debouncedQuery],
    queryFn: () =>
      api
        .get<{ data: TagSuggestion[] }>(
          `/tags?limit=20${debouncedQuery ? `&search=${encodeURIComponent(debouncedQuery)}` : ''}`,
        )
        .then((res) => res.data),
    enabled: open,
  })

  const atLimit = tags.length >= maxTags
  // ไม่โชว์ tag ที่เลือกไปแล้วซ้ำในลิสต์แนะนำ
  const filteredSuggestions = (suggestions ?? []).filter((s) => !tags.includes(s.name))
  const trimmedQuery = query.trim()
  const isNewTag = trimmedQuery.length > 0 && !filteredSuggestions.some((s) => s.name === trimmedQuery)

  function addTag(name: string) {
    const trimmed = name.trim()
    if (trimmed && !tags.includes(trimmed) && !atLimit) {
      onChange([...tags, trimmed])
    }
    setQuery('')
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  return (
    <Popover
      open={open && !disabled}
      onOpenChange={(next) => {
        if (disabled) return
        setOpen(next)
        if (!next) setQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex min-h-11 w-full cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent p-2 text-left disabled:cursor-not-allowed disabled:opacity-50',
            triggerClassName,
          )}
        >
          {tags.length === 0 && (
            <span className="text-sm text-muted-foreground">พิมพ์เพื่อเพิ่มหมวดหมู่ย่อย...</span>
          )}
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              #{tag}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  removeTag(tag)
                }}
                aria-label={`ลบแท็ก ${tag}`}
                className="cursor-pointer hover:text-destructive"
              >
                <X className="size-3" />
              </span>
            </span>
          ))}
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {tags.length}/{maxTags}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-3" align="start">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag(query)
            }
          }}
          placeholder="พิมพ์เพื่อค้นหาหรือเพิ่มหมวดหมู่ย่อยใหม่..."
          disabled={atLimit}
          className="mb-2 h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring disabled:opacity-50"
        />

        {atLimit ? (
          <p className="px-2.5 py-4 text-center text-xs text-muted-foreground">เลือกครบ {maxTags} แท็กแล้ว ลบออกก่อนถึงจะเพิ่มใหม่ได้</p>
        ) : (
          <div className="max-h-64 overflow-y-auto">
            {filteredSuggestions.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => addTag(s.name)}
                className="flex w-full cursor-pointer items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent"
              >
                <span className="truncate">#{s.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{s.count} เรื่อง</span>
              </button>
            ))}

            {isNewTag && (
              <button
                type="button"
                onClick={() => addTag(trimmedQuery)}
                className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-2 text-left text-sm text-primary hover:bg-accent"
              >
                เพิ่มแท็กใหม่ &ldquo;{trimmedQuery}&rdquo;
              </button>
            )}

            {filteredSuggestions.length === 0 && !trimmedQuery && (
              <p className="px-2.5 py-4 text-center text-xs text-muted-foreground">พิมพ์เพื่อค้นหาหรือสร้างหมวดหมู่ย่อยใหม่</p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
