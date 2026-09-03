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

export function GenreSelect() {
  const options = useGenreOptionsStore((state) => state.options)
  const status = useGenreOptionsStore((state) => state.status)

  const placeholder = status === 'loading' || status === 'idle'
    ? 'กำลังโหลดหมวดหมู่...'
    : status === 'error'
      ? 'ไม่สามารถโหลดหมวดหมู่ได้'
      : options.length === 0
        ? 'ไม่มีข้อมูลหมวดหมู่'
        : 'เลือกหมวดหมู่'

  return (
    <div className="space-y-2">
      <Label htmlFor="genre" className="text-sm font-semibold">หมวดหมู่</Label>
      <Select
        name="genre_ids"
        disabled={status !== 'success' || options.length === 0}
      >
        <SelectTrigger id="genre" className="h-11! w-full rounded-xl px-3">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map(({ value, label }) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
