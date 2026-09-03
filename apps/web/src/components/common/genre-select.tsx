'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useGenreOptionsStore } from '@/store/genre-options.store'

interface GenreSelectProps {
  id: string
  name: string
  label: string
  value: string
  onValueChange: (value: string) => void
  excludedValues?: string[]
  error?: string
  required?: boolean
}

export function GenreSelect({
  id,
  name,
  label,
  value,
  onValueChange,
  excludedValues = [],
  error,
  required = false,
}: GenreSelectProps) {
  const options = useGenreOptionsStore((state) => state.options)
  const status = useGenreOptionsStore((state) => state.status)
  const availableOptions = options.filter((option) => (
    option.value === value || !excludedValues.includes(option.value)
  ))

  const placeholder = status === 'loading' || status === 'idle'
    ? 'กำลังโหลดหมวดหมู่...'
    : status === 'error'
      ? 'ไม่สามารถโหลดหมวดหมู่ได้'
      : options.length === 0
        ? 'ไม่มีข้อมูลหมวดหมู่'
        : 'เลือกหมวดหมู่'

  return (
    <div className="space-y-2" data-field={name}>
      <Label htmlFor={id} className="text-sm font-semibold">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <input type="hidden" name={name} value={value} />
      <Select
        value={value}
        onValueChange={onValueChange}
        required={required}
        disabled={status !== 'success' || options.length === 0}
      >
        <SelectTrigger
          id={id}
          className="h-11! w-full rounded-xl px-3"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {availableOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
