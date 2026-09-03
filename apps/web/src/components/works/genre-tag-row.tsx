'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SpecialTagPill } from './special-tag-badges'
import { SPECIAL_TAG_STYLES, splitTags } from '@/lib/special-tags'
import type { CategoryRef } from '@/types'

// ลำดับความสำคัญ (2026-08-05 rev.2 ตาม user ชี้แจงเพิ่ม): เนื้อหา > หมวดหมู่หลัก (เข้มสุด) >
// หมวดหมู่รอง (กลาง) > หมวดหมู่พิเศษ (18+) > หมวดหมู่ย่อย (แท็กอิสระ — BL/GL ปักหน้าสุดของกลุ่มนี้
// ถ้ามี แล้วตามด้วยแท็กทั่วไปที่เหลือ จางสุด) — หน้านี้ ("card info ใหญ่") เท่านั้นที่โชว์ครบทุกอัน
// เต็มรูปแบบไม่ตัดทอน ต่างจาก home/search ที่ต้องจำกัดจำนวน
// จำกัดสูงสุด 2 แถว ถ้าล้นจะโชว์ chevron ให้กดดูทั้งหมดแทน
export function GenreTagRow({
  ageRate,
  categoryMain,
  categorySub,
  tags,
}: {
  ageRate?: string | null
  categoryMain: CategoryRef | null
  categorySub: CategoryRef | null
  tags: string[]
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const [hasOverflow, setHasOverflow] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const { special, rest } = useMemo(() => splitTags(tags), [tags])

  useEffect(() => {
    function checkOverflow() {
      const el = rowRef.current
      if (!el) return
      setHasOverflow(el.scrollHeight > el.clientHeight + 1)
    }
    checkOverflow()
    window.addEventListener('resize', checkOverflow)
    return () => window.removeEventListener('resize', checkOverflow)
  }, [ageRate, categoryMain, categorySub, tags])

  const pills = (
    <>
      {ageRate === '18+' && <SpecialTagPill tag={SPECIAL_TAG_STYLES.age18} />}
      {categoryMain && (
        <span className="whitespace-nowrap rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
          {categoryMain.name}
        </span>
      )}
      {categorySub && (
        <span className="whitespace-nowrap rounded-full bg-primary/50 px-2.5 py-1 text-xs font-medium text-primary-foreground">
          {categorySub.name}
        </span>
      )}
      {special && <SpecialTagPill tag={special} />}
      {rest.map((tag) => (
        <span
          key={tag}
          className="whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
        >
          {tag}
        </span>
      ))}
    </>
  )

  return (
    <>
      <div className="flex items-start gap-1.5">
        <div ref={rowRef} className="flex max-h-[52px] flex-1 flex-wrap gap-1.5 overflow-hidden">
          {pills}
        </div>

        {hasOverflow && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            aria-label="ดูหมวดหมู่ทั้งหมด"
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronDown className="size-4" />
          </button>
        )}
      </div>

      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>หมวดหมู่ทั้งหมด</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5">{pills}</div>
        </DialogContent>
      </Dialog>
    </>
  )
}
