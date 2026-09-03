/**
 * components/placeholder-page.tsx — โครงเปล่าสำหรับแท็บที่ยังไม่ได้ทำเนื้อหาจริง (2026-08-03)
 * ตามที่ user บอก "ถ้ายังไม่มั่นใจอะไรทำเป็น Place holder" — ให้แท็บ/route มีอยู่จริงตั้งแต่ตอนนี้
 * (โครงสร้าง nav ถูกต้องครบ 9 ข้อ) แต่เนื้อหาข้างในรอทำเป็นรอบถัดไป
 */
import type { LucideIcon } from 'lucide-react'

export function PlaceholderPage({
  title,
  icon: Icon,
  note,
}: {
  title: string
  icon: LucideIcon
  note?: string
}) {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">{title}</h1>
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card py-20 text-center">
        <Icon className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">ส่วนนี้ยังไม่เปิดใช้งาน</p>
        <p className="max-w-sm text-xs text-muted-foreground">{note ?? 'รอทำในรอบถัดไป'}</p>
      </div>
    </div>
  )
}
