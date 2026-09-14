'use client'

import { useState } from 'react'
import { ChevronDownIcon, SlidersHorizontalIcon } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StoryType } from '@/constants/story.constant'
import type { LandingSection } from '@/interface/landing.interface'
import { useGenreOptionsStore } from '@/store/genre-options.store'

export function ContentFilterDialog({
  value,
  section,
  categorySlugs,
}: {
  value?: StoryType
  section: LandingSection
  categorySlugs: string[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const categoryOptions = useGenreOptionsStore((state) => state.options)
  const categoryStatus = useGenreOptionsStore((state) => state.status)
  const [open, setOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<StoryType | 'all'>(value ?? 'all')
  const [selectedSection, setSelectedSection] = useState<LandingSection>(section)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(categorySlugs)
  const activeFilterCount = categorySlugs.length + Number(Boolean(value)) + Number(section !== 'random')

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setSelectedType(value ?? 'all')
      setSelectedSection(section)
      setSelectedCategories(categorySlugs)
    }
    setOpen(nextOpen)
  }

  function toggleCategory(categorySlug: string) {
    setSelectedCategories((current) => (
      current.includes(categorySlug)
        ? current.filter((slug) => slug !== categorySlug)
        : [...current, categorySlug]
    ))
  }

  function applyFilters() {
    const params = new URLSearchParams(searchParams.toString())
    if (selectedType === 'all') params.delete('type')
    else params.set('type', selectedType)
    if (selectedSection === 'random') params.delete('sort')
    else params.set('sort', selectedSection)
    if (selectedCategories.length === 0) params.delete('category')
    else params.set('category', selectedCategories.join(','))

    const query = params.toString()
    router.push(query ? `/search?${query}` : '/search')
    setOpen(false)
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('type')
    params.delete('sort')
    params.delete('category')
    setSelectedType('all')
    setSelectedSection('random')
    setSelectedCategories([])

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
              <label className="text-sm font-medium">หมวดหมู่</label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&_svg]:pointer-events-none [&_svg]:shrink-0"
                  >
                    <span className="truncate">
                      {categoryStatus === 'loading' || categoryStatus === 'idle'
                        ? 'กำลังโหลดหมวดหมู่...'
                        : selectedCategories.length === 0
                          ? 'เลือกหมวดหมู่'
                          : `เลือกแล้ว ${selectedCategories.length} หมวดหมู่`}
                    </span>
                    <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-1">
                  {categoryOptions.length === 0 ? (
                    <p className="p-2 text-sm text-muted-foreground">ไม่พบหมวดหมู่</p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto">
                      {categoryOptions.map((category) => {
                        const isSelected = selectedCategories.includes(category.slug)
                        return (
                          <label
                            key={category.value}
                            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm whitespace-nowrap hover:bg-accent"
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleCategory(category.slug)}
                            />
                            <span>{category.label}</span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              {categoryStatus === 'error' ? (
                <p className="text-xs text-destructive">ไม่สามารถโหลดหมวดหมู่ได้</p>
              ) : null}
            </div>
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
