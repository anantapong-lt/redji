import Image from 'next/image'
import Link from 'next/link'
import { BookOpen, Eye, Heart, List } from 'lucide-react'
import { cn, formatCount } from '@/lib/utils'
import { relativeTime } from '@/lib/relative-time'
import { SpecialTagRibbon } from '@/components/works/special-tag-badges'
import { splitTags } from '@/lib/special-tags'
import type { SearchResultData } from '@/types'

// การ์ดผลลัพธ์หน้า /search — ดึงค่าตำแหน่ง/ขนาด/สีตรงจากไฟล์ Figma จริงผ่าน API
// (node 95:263 "Group 87", การ์ด 598x256) ไม่ใช่ประมาณจากภาพ screenshot อีกต่อไป
//
// 2026-08-05 rev.2 (user ชี้แจงเพิ่ม): ตัด pill "18+" ออกจากแถวนี้ (มีวงกลม M มุมปกบอกอยู่แล้ว +
// ต้องกดกรองอยู่แล้ว ไม่จำเป็นต้องซ้ำ) เดิม chip ทุกอันสีเดียวกันหมดดูเหมือนเป็นหมวดหมู่หลักไปหมด
// แก้เป็น 3 ระดับสีเหมือนที่อื่นในแอป (หลัก/รอง/แท็ก) + BL/GL สีเฉพาะตัวปักหน้าสุดของกลุ่มแท็ก —
// แสดง 3 chip ตามการ์ดหน้า Home และพับส่วนเกินเป็น "+n" เพื่อให้จังหวะภาพโล่งเท่ากันทุกหน้า
// 2026-08-08 rev.3: ตัด pill ของ BL/GL ออกจากแถวนี้ด้วยเช่นกัน (ย้ายไปโชว์เป็น ribbon มุมการ์ด
// ผ่าน SpecialTagRibbon แทนวงกลม M เดิม — กันโชว์ซ้ำ 2 ที่)
const MAX_VISIBLE_CHIPS = 3

export function SearchResultCard({ novel }: { novel: SearchResultData }) {
  const coverSrc = novel.cover_image ?? '/novel-cover-placeholder.png'

  const { rest } = splitTags(novel.tags)
  const orderedChips = [
    ...(novel.category_main ? [{ text: novel.category_main.name, className: 'bg-primary text-white' }] : []),
    ...(novel.category_sub ? [{ text: novel.category_sub.name, className: 'bg-primary/60 text-white' }] : []),
    ...rest.map((t) => ({ text: t, className: 'bg-muted text-muted-foreground' })),
  ]
  const visibleChips = orderedChips.slice(0, MAX_VISIBLE_CHIPS)
  const hiddenCount = orderedChips.length - visibleChips.length

  return (
    <Link
      href={`/works/${novel.uuid}`}
      className="group/card flex min-h-[156px] w-full gap-3 overflow-hidden rounded-2xl border border-border/70 bg-card/90 p-2 shadow-[0_14px_28px_-22px_rgb(45_29_32_/_0.56)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_22px_36px_-22px_rgb(45_29_32_/_0.58)] sm:h-[256px] sm:gap-4"
    >
      <div className="relative h-[140px] w-[96px] shrink-0 overflow-hidden rounded-xl bg-muted sm:h-[240px] sm:w-[187px]">
        <Image
          src={coverSrc}
          alt={novel.title}
          fill
          sizes="(max-width: 639px) 96px, 187px"
          unoptimized={coverSrc.startsWith('/')}
          className="object-cover transition-transform duration-500 group-hover/card:scale-[1.045]"
        />
        <SpecialTagRibbon ageRate={novel.age_rate} tags={novel.tags} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col py-1 sm:py-1.5 sm:pr-2">
        <div className="flex items-center gap-1.5">
          <BookOpen className="size-4 shrink-0 text-primary sm:size-5" strokeWidth={2.2} />
          <h3 className="truncate text-base font-bold tracking-[-0.02em] text-foreground sm:text-lg">{novel.title}</h3>
        </div>

        {/* ชื่อนักเขียน — สไตล์เดียวกับ NovelCard/RankingRow (text-xs text-[#848484]) ให้
            ตรงกันทั้งแอป เพราะ Figma frame ของการ์ดนี้โดยเฉพาะไม่มีช่องชื่อนักเขียนแยกไว้ */}
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{novel.author_name}</p>

        {orderedChips.length > 0 && (
          <div className="mt-1.5 flex flex-nowrap items-center gap-1 overflow-hidden sm:mt-2.5">
            {visibleChips.map((chip, i) => (
              <span
                key={`${chip.text}-${i}`}
                className={cn('shrink-0 truncate rounded-sm px-1.5 py-0.5 text-[11px]', chip.className)}
              >
                {chip.text}
              </span>
            ))}
            {hiddenCount > 0 && <span className="shrink-0 text-xs text-muted-foreground">+{hiddenCount}</span>}
          </div>
        )}

        {novel.description && (
          <p className="mt-2 hidden line-clamp-2 text-xs leading-relaxed text-foreground/85 sm:block">&ldquo;{novel.description}&rdquo;</p>
        )}

        <div className="mt-auto flex items-center gap-2 border-t border-primary/12 pt-2 text-xs sm:gap-2.5 sm:pt-2.5">
          <span className="flex items-center gap-0.5 text-amber-700">
            <List className="size-3" />
            {novel.comment_count}
          </span>
          <span className="flex items-center gap-0.5 text-amber-700">
            <Eye className="size-3" />
            {formatCount(novel.view_count)}
          </span>
          <span className="flex items-center gap-0.5 text-rose-700">
            <Heart className="size-3" fill="currentColor" />
            {formatCount(novel.like_count)}
          </span>
          <span className="ml-auto hidden shrink-0 text-muted-foreground sm:inline">
            {relativeTime(novel.updated_at)}
          </span>
        </div>
      </div>
    </Link>
  )
}

export function SearchGalleryCard({ novel }: { novel: SearchResultData }) {
  const coverSrc = novel.cover_image ?? '/novel-cover-placeholder.png'

  return (
    <Link
      href={`/works/${novel.uuid}`}
      className="group/card overflow-hidden rounded-2xl border border-border/70 bg-card/90 shadow-[0_14px_28px_-22px_rgb(45_29_32_/_0.56)] transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_22px_36px_-22px_rgb(45_29_32_/_0.58)]"
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-muted">
        <Image
          src={coverSrc}
          alt={novel.title}
          fill
          sizes="(max-width: 639px) 48vw, (max-width: 1023px) 30vw, 220px"
          unoptimized={coverSrc.startsWith('/')}
          className="object-cover transition-transform duration-500 group-hover/card:scale-[1.045]"
        />
        <SpecialTagRibbon ageRate={novel.age_rate} tags={novel.tags} />
      </div>
      <div className="p-3">
        <div className="flex items-center gap-1.5">
          <BookOpen className="size-4 shrink-0 text-primary" strokeWidth={2.2} />
          <h3 className="truncate text-sm font-bold tracking-[-0.02em] text-foreground">{novel.title}</h3>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">{novel.author_name}</p>
        <div className="mt-3 flex items-center gap-2 border-t border-primary/12 pt-2 text-[11px]">
          <span className="flex items-center gap-0.5 text-amber-700">
            <Eye className="size-3" />
            {formatCount(novel.view_count)}
          </span>
          <span className="flex items-center gap-0.5 text-rose-700">
            <Heart className="size-3" fill="currentColor" />
            {formatCount(novel.like_count)}
          </span>
        </div>
      </div>
    </Link>
  )
}
