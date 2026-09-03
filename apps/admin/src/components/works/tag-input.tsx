'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

// พอร์ตมาจาก apps/web/src/components/writer/tag-input.tsx ตรงๆ (2026-08-04)
export function TagInput({
  tags,
  onChange,
  maxTags = 10,
  className,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  maxTags?: number
  className?: string
}) {
  const [input, setInput] = useState('')
  const atLimit = tags.length >= maxTags

  function addTag() {
    const trimmed = input.trim()
    if (trimmed && !tags.includes(trimmed) && !atLimit) {
      onChange([...tags, trimmed])
    }
    setInput('')
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  return (
    <div
      className={cn(
        'flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent p-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
        className,
      )}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            aria-label={`ลบแท็ก ${tag}`}
            className="cursor-pointer hover:text-destructive"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {!atLimit && (
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag()
            }
          }}
          placeholder={tags.length === 0 ? 'พิมพ์แล้วกด Enter เพื่อเพิ่มแท็ก' : ''}
          className="min-w-32 flex-1 bg-transparent text-sm outline-none"
        />
      )}
      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
        {tags.length}/{maxTags}
      </span>
    </div>
  )
}
