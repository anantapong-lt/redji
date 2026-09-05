'use client'

import { CalendarIcon } from 'lucide-react'
import { th } from 'react-day-picker/locale'
import { Calendar } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function DateTimePicker({ id, value, onChange, disabled, label = 'เลือกวันและเวลา' }: {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  label?: string
}) {
  const parsed = value ? new Date(value) : undefined
  const selected = parsed && Number.isFinite(parsed.getTime()) ? parsed : undefined
  const hours = value.slice(11, 13) || '00'
  const minutes = value.slice(14, 16) || '00'

  function selectDate(date: Date | undefined) {
    if (!date) return
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    onChange(`${day}T${hours}:${minutes}`)
  }

  return <Popover>
    <PopoverTrigger asChild>
      <Button id={id} type="button" variant="outline" disabled={disabled} aria-label={label} className="h-9 w-full min-w-0 justify-start bg-background px-2 text-left text-xs font-normal shadow-none">
        <CalendarIcon className="size-4 shrink-0" />
        <span className="truncate">{selected ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }).format(selected) : 'เลือกวันและเวลา'}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-0">
      <Calendar locale={th} mode="single" selected={selected} defaultMonth={selected} onSelect={selectDate} disabled={disabled} />
      <div className="space-y-2 border-t p-3">
        <Label className="text-xs">เวลา</Label>
        <div className="flex items-center gap-2">
          <Select value={hours} disabled={disabled || !selected} onValueChange={(hour) => onChange(`${value.slice(0, 10)}T${hour}:${minutes}`)}>
            <SelectTrigger aria-label="ชั่วโมง" className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>{Array.from({ length: 24 }, (_, index) => String(index).padStart(2, '0')).map((hour) => <SelectItem key={hour} value={hour}>{hour}</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-muted-foreground">:</span>
          <Select value={minutes} disabled={disabled || !selected} onValueChange={(minute) => onChange(`${value.slice(0, 10)}T${hours}:${minute}`)}>
            <SelectTrigger aria-label="นาที" className="min-w-0 flex-1"><SelectValue /></SelectTrigger>
            <SelectContent>{Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0')).map((minute) => <SelectItem key={minute} value={minute}>{minute}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {!selected && <p className="text-xs text-muted-foreground">เลือกวันที่ก่อนกำหนดเวลา</p>}
      </div>
    </PopoverContent>
  </Popover>
}
