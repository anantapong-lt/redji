import Image from 'next/image'
import Link from 'next/link'
import { BookOpen, Eye, Heart, List } from 'lucide-react'
import { formatCount } from '@/lib/utils'
import { CategoryChips } from './category-chips'
import { SpecialTagRibbon } from '@/components/works/special-tag-badges'
import type { NovelCardData } from '@/types'
import type { ReactNode } from 'react'

// การ์ดหน้าแรก (carousel แนวตั้ง 186x385) — ดึงค่าตรงจากไฟล์ Figma จริงผ่าน API
// (node 68:455 "Card 1" ในเซคชัน "เรื่องเด่นประจำสัปดาห์") ไม่ใช่ประมาณจากภาพ
// ขนาด 186px นี้เป็นค่าเดสก์ท็อปล้วนๆ ไม่มีเวอร์ชันมือถือใน Figma — บนจอแคบ (< md) เลยย่อ
// ลงเหลือ 140px (คง aspect ratio เดิม 186:237 ไว้) ให้เห็นการ์ดถัดไปโผล่มาบางส่วนในแถวเลื่อน
// แนวนอน แทนที่จะพอดีแค่ใบเดียวครึ่งๆ กลางๆ — ดู novel-section.tsx (หน้าแรก) และ
// gallery/page.tsx (grid ใช้ minmax คู่กับความกว้างนี้ ต้องแก้พร้อมกันถ้าจะเปลี่ยนอีก)
// compact = ตัดหมวดหมู่+ชื่อนักเขียนออก เหลือแค่ปก/ชื่อเรื่อง/stat (2026-07-29 ใช้ในแท็บ
// "ทั้งหมด" ของกล่องเก็บนิยายหน้าโปรไฟล์ ตามที่ user ขอ ไม่กระทบการใช้งานเดิมที่อื่น)
// hideCategories/footer = สำหรับหน้า Feed (2026-07-29) — เอาแค่หมวดหมู่ออกแต่ยังโชว์ชื่อ
// นักเขียนอยู่ (คนละแบบกับ compact ที่ตัดทั้งคู่) พร้อมสลับแถบใต้เส้นจาก stat เดิม (ตอน/ยอดดู/
// หัวใจ) เป็นเนื้อหาที่ส่งมาเอง (เลขตอน+เวลา ของการ์ด "อ่านล่าสุด"/"เรื่องที่กดดาว")
export function NovelCard({
  novel,
  compact = false,
  hideCategories = false,
  footer,
  priority = false,
}: {
  novel: NovelCardData
  compact?: boolean
  hideCategories?: boolean
  footer?: ReactNode
  /** ตั้ง true เฉพาะการ์ดที่เห็นทันทีตั้งแต่เปิดหน้า (เช่น 2-3 ใบแรกของแถวแรก) — ให้ผู้เรียกที่วน
      .map() เป็นคนกำหนดตาม index เอง อย่าใส่ true ทุกใบ ไม่งั้นรูปจะแย่งกันโหลดพร้อมกันหมด */
  priority?: boolean
}) {
  const coverSrc = novel.cover_image ?? '/novel-cover-placeholder.png'

  return (
    <Link
      href={`/works/${novel.uuid}`}
      className="group/card flex w-[140px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-[0_14px_28px_-22px_rgb(45_29_32_/_0.56)] transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/20 hover:shadow-[0_22px_36px_-22px_rgb(45_29_32_/_0.58)] md:w-[186px]"
    >
      <div className="relative h-[178px] w-[140px] shrink-0 bg-muted md:h-[237px] md:w-[186px]">
        <Image
          src={coverSrc}
          alt={novel.title}
          fill
          sizes="(min-width: 768px) 186px, 140px"
          unoptimized={coverSrc.startsWith('/')}
          className="object-cover transition-transform duration-500 group-hover/card:scale-[1.045]"
          priority={priority}
        />
        <SpecialTagRibbon ageRate={novel.age_rate} tags={novel.tags} />
      </div>

      <div className="flex flex-col px-3 pt-3.5 pb-3">
        <div className="flex items-center gap-1.5">
          <BookOpen className="size-4 shrink-0 text-primary" strokeWidth={2.2} />
          <h3 className="truncate text-base font-bold tracking-[-0.02em] text-foreground">{novel.title}</h3>
        </div>

        {!compact && !hideCategories && (
          <div className="mt-2.5">
            <CategoryChips
              categoryMain={novel.category_main}
              categorySub={novel.category_sub}
              tags={novel.tags}
            />
          </div>
        )}

        {!compact && <p className="mt-0.5 truncate text-xs text-muted-foreground">{novel.author_name}</p>}

        {footer ?? (
          <div className="mt-3 flex items-center gap-2.5 border-t border-primary/12 pt-2.5 text-xs">
            <span className="flex items-center gap-0.5 text-amber-700">
              <List className="size-3" />
              {novel.episode_count}
            </span>
            <span className="flex items-center gap-0.5 text-amber-700">
              <Eye className="size-3" />
              {formatCount(novel.view_count)}
            </span>
            <span className="flex items-center gap-0.5 text-rose-700">
              <Heart className="size-3" fill="currentColor" />
              {formatCount(novel.like_count)}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
