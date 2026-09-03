'use client'

import { useMemo, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { CategoryRef } from '@/types'

/**
 * SearchableSelect — dropdown ที่พิมพ์ค้นหาได้ในตัว (แทนการเลื่อนหาในลิสต์ยาวๆ)
 * เลือกได้เฉพาะตัวเลือกที่มีอยู่จริงเท่านั้น (ไม่ใช่ free text)
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'ทั้งหมด',
  triggerClassName,
  disabled = false,
  getOptionColorClass,
}: {
  options: CategoryRef[]
  value: CategoryRef | null
  onChange: (value: CategoryRef | null) => void
  placeholder?: string
  /** เผื่อหน้าที่พื้นหลังตรงกับ bg-transparent ปกติ (เช่น --card กับ --background สีเดียวกัน)
   *  ต้องบังคับพื้นขาวชัดเจนแทน */
  triggerClassName?: string
  // 2026-07-30 หน้า /search โหมด "นักเขียน" — ตัวกรองพวกนี้กรองคุณสมบัติของ "เรื่อง" ไม่ใช่
  // "คนเขียน" เลยต้องปิดไว้ (เทาจาง+กดไม่ได้) สื่อว่าใส่ค่าไปก็ไม่มีผลกับผลลัพธ์
  disabled?: boolean
  // 2026-08-05 ใหม่ — หน้า /search ใส่ตัวเลือกพิเศษ (วาย/ยูริ) ปนเข้ามาใน options ของ "หมวดหมู่รอง"
  // ต้อง highlight สีเฉพาะตัวให้ต่างจากหมวดหมู่ปกติ (สื่อถึงความพิเศษ) — undefined = ไม่ใช่ตัวพิเศษ
  // ใช้สี default ตามปกติ ไม่กระทบจุดอื่นที่ไม่ส่ง prop นี้มาเลย
  getOptionColorClass?: (option: CategoryRef) => string | undefined
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () => options.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase())),
    [options, query],
  )

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
            'flex h-9 w-full cursor-pointer items-center justify-between rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
            triggerClassName,
          )}
        >
          <span className={cn('truncate', !value && 'text-muted-foreground', value && getOptionColorClass?.(value))}>
            {value?.name ?? placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1.5" align="start">
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
            }}
            className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
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
              }}
              className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              {value?.id === option.id && <Check className="size-3.5 shrink-0" />}
              <span className={cn('truncate', getOptionColorClass?.(option))}>{option.name}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">ไม่พบหมวดหมู่</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
