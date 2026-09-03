import Link from 'next/link'
import { BookOpen } from 'lucide-react'

// สถานะว่างของกล่องผลงานหน้าโปรไฟล์ตัวเอง — อ้างอิงโครงจาก Tofu Novel (ไอคอนหนังสือ + ข้อความ +
// ปุ่ม CTA) — 2026-07-29: แยกเป็น 2 variant เพราะกล่องนี้มีความหมายต่างกันตามบทบาท: นักเขียน
// (isWriter) โชว์ผลงานที่เผยแพร่เอง ชวนไปเขียน — นักอ่านทั่วไปโชว์บุ๊คมาร์คแทน ชวนไปอ่าน/เก็บนิยาย
const VARIANTS = {
  writer: {
    title: 'ยังไม่มีผลงานที่เผยแพร่',
    description: 'เริ่มเขียนนิยายเรื่องแรกของคุณเพื่อให้โปรไฟล์ของคุณมีชีวิตชีวา',
    href: '/writer/works/new',
    cta: 'เขียนนิยายใหม่',
  },
  reader: {
    title: 'ยังไม่มีนิยายที่ติดตาม',
    description: 'เริ่มอ่านนิยายและกดดาวติดตามเรื่องที่ชอบเพื่อให้โปรไฟล์ของคุณมีชีวิตชีวา',
    href: '/search',
    cta: 'ไปเลือกนิยาย',
  },
} as const

export function ProfileEmptyState({ variant }: { variant: 'writer' | 'reader' }) {
  const { title, description, href, cta } = VARIANTS[variant]

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <BookOpen className="size-12 text-muted-foreground/40" strokeWidth={1.5} />
      <div>
        <p className="text-base font-bold text-black">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Link
        href={href}
        className="rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
      >
        {cta}
      </Link>
    </div>
  )
}
