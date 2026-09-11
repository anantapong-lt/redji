'use client'

import { useState } from 'react'
import { SlidersHorizontalIcon } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StoryType } from '@/constants/story.constant'
import type { LandingSection } from '@/interface/landing.interface'

export function ContentFilterDialog({ value, section }: { value?: StoryType; section: LandingSection }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<StoryType | 'all'>(value ?? 'all')
  const [selectedSection, setSelectedSection] = useState<LandingSection>(section)
  const activeFilterCount = Number(Boolean(value)) + Number(section !== 'random')

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setSelectedType(value ?? 'all')
      setSelectedSection(section)
    }
    setOpen(nextOpen)
  }

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString())
    if (selectedType === 'all') params.delete('type')
    else params.set('type', selectedType)
    if (selectedSection === 'random') params.delete('sort')
    else params.set('sort', selectedSection)

    const query = params.toString()
    router.push(query ? `/search?${query}` : '/search')
    setOpen(false)
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('type')
    params.delete('sort')
    setSelectedType('all')
    setSelectedSection('random')

    const query = params.toString()
    router.push(query ? `/search?${query}` : '/search')
    setOpen(false)
  }

  return (
    <>
      {value ? <input type="hidden" name="type" value={value} /> : null}
      {section !== 'random' ? <input type="hidden" name="sort" value={section} /> : null}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="icon" className="relative size-12 bg-white" aria-label="ตัวกรอง" title="ตัวกรอง">
            <SlidersHorizontalIcon className="size-5" />
            {activeFilterCount > 0 ? (
              <Badge className="absolute -top-1 -right-1 size-5 p-0 text-[11px]">
                {activeFilterCount}
              </Badge>
            ) : null}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ตัวกรอง</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="content-type" className="text-sm font-medium">ประเภทเนื้อหา</label>
              <Select value={selectedType} onValueChange={(nextValue) => setSelectedType(nextValue as StoryType | 'all')}>
                <SelectTrigger id="content-type" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value={StoryType.NOVEL}>นิยาย</SelectItem>
                  <SelectItem value={StoryType.MANGA}>มังงะ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="sort-order" className="text-sm font-medium">เรียงตาม</label>
              <Select value={selectedSection} onValueChange={(nextValue) => setSelectedSection(nextValue as LandingSection)}>
                <SelectTrigger id="sort-order" className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">---</SelectItem>
                  <SelectItem value="latest">ตอนใหม่ล่าสุด</SelectItem>
                  <SelectItem value="weekly">ยอดนิยมประจำสัปดาห์</SelectItem>
                  <SelectItem value="all-time">ยอดนิยมที่สุด</SelectItem>
                  <SelectItem value="most-followed">เรื่องที่ติดตามเยอะสุด</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={clearFilters}>ล้างตัวกรอง</Button>
            <Button type="button" onClick={applyFilters}>ใช้ตัวกรอง</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
