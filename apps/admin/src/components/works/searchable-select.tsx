'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CategoryRef } from '@/types'

/**
 * SearchableSelect — dropdown ที่พิมพ์ค้นหาได้ในตัว (2026-08-04, พอร์ต concept มาจาก
 * apps/web/src/components/writer/searchable-select.tsx แต่เขียนใหม่แบบ hand-rolled ไม่พึ่ง
 * Radix Popover — apps/admin ไม่มี Radix เลยทั้งแอป ตรงกับแนวทาง Modal ที่ "ทำเองล้วนๆ" อยู่แล้ว)
 * เลือกได้เฉพาะตัวเลือกที่มีอยู่จริงเท่านั้น (ไม่ใช่ free text)
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'ทั้งหมด',
}: {
  options: CategoryRef[]
  value: CategoryRef | null
  onChange: (value: CategoryRef | null) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const filtered = useMemo(
    () => options.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query],
  )

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full cursor-pointer items-center justify-between rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className={cn('truncate', !value && 'text-muted-foreground')}>{value?.name ?? placeholder}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 w-full min-w-48 rounded-lg border border-border bg-card p-1.5 shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="พิมพ์เพื่อค้นหา..."
            className="mb-1.5 h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
          />
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onChange(null)
                setOpen(false)
                setQuery('')
              }}
              className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted"
            >
              ทั้งหมด
            </button>
            {filtered.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  onChange(option)
                  setOpen(false)
                  setQuery('')
                }}
                className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                {value?.id === option.id && <Check className="size-3.5 shrink-0" />}
                <span className="truncate">{option.name}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">ไม่พบหมวดหมู่</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
