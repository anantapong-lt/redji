/**
 * components/works/special-tag-badges.tsx — badge ของ "หมวดหมู่ย่อยพิเศษ" 18+/BL/GL (rev.3)
 *
 * rev.2: ตัด SpecialTagPills/SpecialTagCornerBadges แบบ all-in-one เดิมทิ้ง — แต่ละหน้าประกอบเอง
 * rev.3 (2026-08-08): เดิมมุมการ์ดมีแค่วงกลม "M" (18+) ส่วน BL/GL โผล่เป็น pill ปนอยู่ในแถว
 * หมวดหมู่แทน — user ขอรวมทั้ง 18+/BL/GL เป็น "ribbon" เดียวที่มุมการ์งแทนวงกลม M เดิม (ไม่ล้น
 * ออกนอกการ์ด, ปลายมีรอยตัดคล้ายริบบิ้นคาดหนังสือ) แล้วตัด pill ของ BL/GL ออกจากแถวหมวดหมู่เดิม
 * (กันโชว์ซ้ำ 2 ที่) — SpecialTagPill ยังเก็บไว้ใช้ต่อในบริบทที่ไม่ใช่การ์ดมีรูป (เช่น GenreTagRow
 * หน้ารายละเอียด, ตัวเลือกตอนสร้าง/แก้ไขผลงาน)
 *
 * - SpecialTagPill: pill เต็มคำ 1 อัน (ใช้ได้ทั้ง 18+/BL/GL) — ประกอบเรียงเองตามลำดับที่ต้องการ
 * - SpecialTagRibbon: ริบบิ้นมุมขวาบนของการ์ด (ต้องอยู่ใน parent ที่เป็น relative + overflow-hidden
 *   เสมอ กันล้นออกนอกการ์ด) รวม 18+/BL/GL เป็นป้ายเดียว ดูตรรกะเลือก label/สีที่ getCardRibbon()
 */

import { cn } from '@/lib/utils'
import { getCardRibbon, type SpecialTagStyle } from '@/lib/special-tags'

export function SpecialTagPill({ tag, className }: { tag: SpecialTagStyle; className?: string }) {
  return (
    <span className={cn('whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium', tag.bg, tag.text, className)}>
      {tag.label}
    </span>
  )
}

export function SpecialTagRibbon({
  ageRate,
  tags,
}: {
  ageRate?: string | null
  tags?: string[] | null
}) {
  const ribbon = getCardRibbon(ageRate, tags)
  if (!ribbon) return null

  return (
    <div className="absolute top-3 right-0 z-10 max-w-[70%]">
      <span
        className={cn(
          'flex items-center py-1 pr-3 pl-3.5 text-[11px] font-bold tracking-wide text-white shadow-sm',
          'bg-gradient-to-br',
          ribbon.from,
          ribbon.to,
        )}
        style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 10px 50%)' }}
      >
        {ribbon.label}
      </span>
    </div>
  )
}
