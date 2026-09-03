import { splitTags } from '@/lib/special-tags'
import type { CategoryRef } from '@/types'

// การ์ดแคบ (home/works-table) — คงความสูงคงที่เสมอไม่ว่าจะมีแท็กกี่อัน (2026-08-05 rev.2: user
// ชี้ว่าเดิม flex-wrap ยืดการ์ดสูงขึ้นเวลามีหมวดหมู่พิเศษเพิ่มมา ไม่สม่ำเสมอกับการ์ดที่ไม่มี) —
// โชว์ตายตัวแค่ 2 pill (หลัก/รอง) แถวเดียว ที่เหลือพับเป็น "+n" เสมอ
// 2026-08-08 rev.3: ตัด pill ของ BL/GL ออกจากแถวนี้แล้ว (ย้ายไปโชว์เป็น ribbon มุมการ์ดแทน ผ่าน
// SpecialTagRibbon ใน novel-card.tsx — กันโชว์ซ้ำ 2 ที่) แต่ยังต้องเรียก splitTags() อยู่ เพื่อให้
// "+n" นับ rest ไม่รวม BL/GL ซ้ำ (ตรงกับพฤติกรรมเดิม)
export function CategoryChips({
  categoryMain,
  categorySub,
  tags,
}: {
  categoryMain: CategoryRef | null
  categorySub: CategoryRef | null
  tags: string[]
}) {
  const { rest } = splitTags(tags)

  return (
    <div className="mb-1.5 flex items-center gap-1 overflow-hidden">
      {categoryMain && (
        <span className="min-w-0 shrink truncate rounded-sm bg-primary px-1.5 py-0.5 text-[11px] text-primary-foreground">
          {categoryMain.name}
        </span>
      )}
      {categorySub && (
        <span className="min-w-0 shrink truncate rounded-sm bg-primary/60 px-1.5 py-0.5 text-[11px] text-primary-foreground">
          {categorySub.name}
        </span>
      )}
      {rest.length > 0 && <span className="shrink-0 text-[11px] text-muted-foreground">+{rest.length}</span>}
    </div>
  )
}
