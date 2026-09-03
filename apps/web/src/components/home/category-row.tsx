'use client'

/**
 * components/home/category-row.tsx — "หมวดหมู่" หน้าแรก (2026-08-17, ปรับหน้าตาใหม่ทั้งชุด)
 *
 * เดิมเป็นการ์ดไล่เฉดสีเลื่อนแนวนอน (carousel) โชว์แค่หมวดหมู่หลัก/รอง (ตาราง categories) —
 * ตอนนี้เปลี่ยนเป็นกริดปุ่มไล่เฉดสีวนบรรทัดได้ (wrap) พร้อมสวิช 3 จังหวะเลือกแหล่งข้อมูล:
 *   1. "หมวดหมู่" — categories (หมวดหมู่หลัก/รอง) + tag พิเศษที่ปักหมุดไว้ (ดู PINNED_TAG_STYLES
 *      ด้านล่าง — ปัจจุบันคือ BL/GL) รวมกัน ไม่รวม tag ทั่วไปอื่นๆ
 *   2. "ทั้งหมด"  — categories + tag เสริมทุกตัว (รวม pinned) รวมกัน เรียงตามจำนวนเรื่องที่ใช้จริง
 *   3. "แท็ก"    — เฉพาะ tag เสริมทั้งหมด (รวม pinned) ไม่มี categories ปน
 *
 * BL/GL (2026-08-17 รอบสี่ — user เน้นย้ำอีกรอบ): **ไม่ใช่** หมวดหมู่หลัก/รอง (ตาราง categories
 * id 11/12 ถูกปิดการมองเห็นแล้วตั้งแต่รอบก่อน) แต่เป็น tag ธรรมดาที่กรองแบบเดียวกับ tag ทั่วไปในหน้า
 * search ทุกประการ (ผูก SPECIAL_TAG_STYLES ใน special-tags.ts ที่มีอยู่แล้ว) — "พิเศษ" แค่ตรงที่ user
 * ขอให้ปักหมุดโชว์ในแท็บ "หมวดหมู่" (แท็บแรก) ด้วยเสมอ เพราะเป็น genre คนสนใจเยอะ พร้อมสไตล์ไล่เฉดสี
 * แบบเดียวกับหมวดหมู่จริง (ไม่ใช่สีเทาแบนของ tag ทั่วไป) ให้ดูโดดเด่นสมกับที่ "ถูกลากขึ้นมา" — สีที่ใช้
 * ยืมมาจาก SPECIAL_TAG_STYLES.bl/gl (ribbon สีเดิมที่ใช้อยู่แล้วบนการ์ด/หน้ารายละเอียด) ให้ตรงกันทั้งเว็บ
 *
 * tag "Erotic" ผูกกับระบบเตือนอายุ 18+ ที่มีอยู่แล้ว — ลิงก์ของ tag นี้แนบ age_rate=18+ เพิ่มเข้าไป
 * ด้วยเสมอ ไม่ใช่แค่ tags=Erotic เฉยๆ (ยังไม่ปักหมุดเหมือน BL/GL เพราะยังไม่มีเรื่องไหนติด tag นี้เลย)
 *
 * สี tag ทั่วไป (ไม่ปักหมุด) = "Plain" ตามที่ user ขอ (เหมือน tag เสริมในหน้า work detail —
 * GenreTagRow's bg-muted/text-muted-foreground) ใส่ # นำหน้าเสมอ
 *
 * ลิงก์ category → /search?category_main_id=X, tag → /search?tags=X (+age_rate=18+ ถ้าเป็น Erotic)
 * — ใช้งานได้จริงแล้ว (แก้ apps/web/(main)/search/page.tsx ให้อ่านค่าพวกนี้จาก URL ตอน mount
 * ไปพร้อมกัน เดิมมีแค่ sort/date_range ที่อ่านจริง ตัวกรองพวกนี้เคยถูกเมินเฉยมาตลอด)
 *
 * จำกัดสูงสุด 2 แถวเสมอ — clip ด้วย max-height เท่ากับความสูงปุ่ม×2 + gap×1 พอดี (ปุ่มทุกใบสูงเท่ากัน
 * เสมอเพราะ h-10/h-11 คงที่ ตัดตรงกลาง gap ระหว่างแถวเป๊ะๆ ไม่มีทางตัดโป่งกลางปุ่มแถวที่ 3)
 *
 * ตัดหมวดหมู่ที่ยังไม่มีเรื่องไหนใช้ทิ้ง (work_count===0) — tag ไม่ต้องกรองเพิ่มเพราะ
 * getTagSuggestions() คืนแค่ tag ที่ใช้จริงอยู่แล้ว เป็น INNER JOIN
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface ApiCategoryRow {
  id: string
  name: string
  icon: string | null
  work_count: number
}

interface ApiTagRow {
  name: string
  count: number
}

// tag ที่ถือเป็นเนื้อหา 18+ — คลิกแล้วกรอง age_rate=18+ เพิ่มโดยอัตโนมัติ (มติ 2026-08-17)
const AGE_GATED_TAGS = new Set(['Erotic'])

// tag พิเศษที่ปักหมุดให้โชว์ในแท็บ "หมวดหมู่" เสมอ (ไม่ใช่แค่แท็บ "แท็ก") พร้อมสไตล์ไล่เฉดสีเฉพาะตัว —
// สียืมมาจาก special-tags.ts (SPECIAL_TAG_STYLES.bl/gl) ให้ตรงกับ ribbon บนการ์ด/หน้ารายละเอียดเป๊ะ
const PINNED_TAG_STYLES: Record<string, { icon: string; gradient: string }> = {
  BL: { icon: '🌈', gradient: 'from-sky-600 to-sky-400' },
  GL: { icon: '🌸', gradient: 'from-purple-600 to-violet-400' },
}

// gradient สองสีของปุ่มหมวดหมู่หลัก/รอง — ไล่จากเข้ม (ซ้าย) ไปสด (ขวา) เฉดเดียวกันเสมอ วนตาม index
// เพราะ categories ยังไม่มีฟิลด์สีต่อหมวดจาก backend
const TILE_GRADIENTS = [
  'from-rose-600 to-rose-400',
  'from-sky-600 to-sky-400',
  'from-violet-600 to-violet-400',
  'from-emerald-600 to-emerald-400',
  'from-amber-600 to-amber-400',
  'from-fuchsia-600 to-fuchsia-400',
  'from-cyan-600 to-cyan-400',
  'from-orange-600 to-orange-400',
]

const DEFAULT_ICON = '📚'

type Mode = 'categories' | 'combined' | 'tags'

const MODE_TABS: { key: Mode; label: string }[] = [
  { key: 'categories', label: 'หมวดหมู่' },
  { key: 'combined', label: 'ทั้งหมด' },
  { key: 'tags', label: 'แท็ก' },
]

interface Pill {
  key: string
  label: string
  icon: string | null
  count: number
  href: string
  style: 'gradient' | 'plain'
  gradient?: string
}

function tagHref(name: string): string {
  const params = new URLSearchParams({ tags: name })
  if (AGE_GATED_TAGS.has(name)) params.set('age_rate', '18+')
  return `/search?${params.toString()}`
}

export function CategoryRow() {
  const [mode, setMode] = useState<Mode>('categories')

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ data: ApiCategoryRow[] }>('/categories').then((res) => res.data),
  })
  // limit 30 ให้พอมีที่ว่างสำหรับ tag ที่ใช้จริงเยอะๆ (default endpoint คือ 20 — ใช้ร่วมกับ
  // autocomplete ตอนเขียนนิยายด้วย ไม่กระทบกันเพราะเป็น query แยก) เรียงจากมากไปน้อยมาจาก
  // backend อยู่แล้ว (getTagSuggestions() ORDER BY count DESC)
  const { data: tagsData } = useQuery({
    queryKey: ['tags', 'home'],
    queryFn: () => api.get<{ data: ApiTagRow[] }>('/tags?limit=30').then((res) => res.data),
  })

  // ตัดหมวดหมู่ที่ยังไม่มีเรื่องไหนใช้เลยทิ้ง (work_count === 0)
  const categoryPills: Pill[] = (categoriesData ?? [])
    .filter((c) => c.work_count > 0)
    .map((c) => ({
      key: `cat-${c.id}`,
      label: c.name,
      icon: c.icon ?? DEFAULT_ICON,
      count: c.work_count,
      href: `/search?category_main_id=${c.id}`,
      style: 'gradient' as const,
    }))
    .map((p, i) => ({ ...p, gradient: TILE_GRADIENTS[i % TILE_GRADIENTS.length] }))

  const allTagPills: Pill[] = (tagsData ?? []).map((t) => {
    const pinned = PINNED_TAG_STYLES[t.name]
    return pinned
      ? {
          key: `tag-${t.name}`,
          label: t.name,
          icon: pinned.icon,
          count: t.count,
          href: tagHref(t.name),
          style: 'gradient' as const,
          gradient: pinned.gradient,
        }
      : {
          key: `tag-${t.name}`,
          label: t.name,
          icon: null,
          count: t.count,
          href: tagHref(t.name),
          style: 'plain' as const,
        }
  })
  const pinnedTagPills = allTagPills.filter((p) => p.style === 'gradient')
  const regularTagPills = allTagPills.filter((p) => p.style === 'plain')

  const pills: Pill[] =
    mode === 'categories'
      ? [...categoryPills, ...pinnedTagPills].sort((a, b) => b.count - a.count)
      : mode === 'tags'
        ? allTagPills.sort((a, b) => b.count - a.count)
        : [...categoryPills, ...allTagPills].sort((a, b) => b.count - a.count)

  if (categoryPills.length === 0 && allTagPills.length === 0) return null

  return (
    <section className="mx-auto mt-4 max-w-[1280px] px-4 md:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="readji-page-title flex items-center gap-2 text-lg md:text-xl">
          <span className="h-5 w-1 rounded-full bg-primary/80" />
          หมวดหมู่
        </h2>

        {/* สวิช 3 จังหวะ — เลือกแหล่งข้อมูลที่จะโชว์ */}
        <div className="relative flex h-9 items-center rounded-full border border-border/60 bg-white p-1 shadow-sm">
          <div
            className="absolute inset-y-1 w-[calc(33.333%-0.166rem)] rounded-full bg-primary shadow-sm transition-transform duration-200"
            style={{ transform: `translateX(${MODE_TABS.findIndex((t) => t.key === mode) * 100}%)` }}
          />
          {MODE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMode(tab.key)}
              className={cn(
                'relative z-10 flex h-full w-20 cursor-pointer items-center justify-center rounded-full text-xs font-semibold transition-colors sm:w-24 sm:text-sm',
                mode === tab.key ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* pills grid — max-h ตัดให้เหลือ 2 แถวเสมอ เท่ากับความสูงปุ่ม×2 + gap×1 พอดี (มือถือ
          40×2+8=88px, sm ขึ้นไป 44×2+10=98px) กัน section รกยาวเกิน (ตัดตรงกลาง gap พอดี ไม่มีทาง
          ตัดโป่งกลางปุ่มแถวที่ 3 เพราะทุกปุ่มสูงเท่ากันคงที่) ไม่ทำปุ่ม "ดูทั้งหมด" เพิ่มเพราะไม่ได้ขอ */}
      {pills.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลในหมวดนี้</p>
      ) : (
        <div className="flex max-h-[88px] flex-wrap gap-2 overflow-hidden sm:max-h-[98px] sm:gap-2.5">
          {pills.map((pill) =>
            pill.style === 'gradient' ? (
              <Link
                key={pill.key}
                href={pill.href}
                className={cn(
                  'flex h-10 shrink-0 items-center gap-2 rounded-full bg-gradient-to-r px-3.5 shadow-sm transition-[filter] hover:brightness-110 sm:h-11 sm:px-4',
                  pill.gradient,
                )}
              >
                <span className="text-base leading-none sm:text-lg">{pill.icon}</span>
                <span className="text-sm font-semibold text-white sm:text-base">{pill.label}</span>
              </Link>
            ) : (
              <Link
                key={pill.key}
                href={pill.href}
                className="flex h-10 shrink-0 items-center rounded-full bg-muted px-3.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-muted/70 hover:text-foreground sm:h-11 sm:px-4 sm:text-base"
              >
                #{pill.label}
              </Link>
            ),
          )}
        </div>
      )}
    </section>
  )
}
