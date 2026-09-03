'use client'

/**
 * app/(dashboard)/site/page.tsx — "ตั้งหน้าเว็บไซต์" (2026-08-04, ต่อจริงตามที่ user ขอ)
 *
 * 3 แท็บ (ลำดับยืนยันจาก user แล้ว): Carousel → นิยายแนะนำ → ประวัติ
 * - Carousel: ดู carousel-tab.tsx
 * - นิยายแนะนำ: ระบบ "บูสต์แบบ Cheesy" ดู featured-tab.tsx
 * - ประวัติ: scope เฉพาะ carousel/นิยายแนะนำ ดู site-history-tab.tsx (ต่างจากหน้า "ประวัติ" ใหญ่
 *   /history ที่ครอบคลุมทุก action ในระบบ)
 *
 * ล็อก level >= 9 ทั้งหน้า (backend ทุก endpoint ในนี้เช็ค level >= 9 อยู่แล้ว — เดิม nav
 * ให้ level 8 เข้าได้ ตอนนี้เปลี่ยนเป็น 9 ให้ตรงกัน ดู layout.tsx)
 */

import { useState } from 'react'
import { LayoutTemplate } from 'lucide-react'
import { CarouselTab } from '@/components/site/carousel-tab'
import { FeaturedTab } from '@/components/site/featured-tab'
import { AnnouncementTab } from '@/components/site/announcement-tab'
import { CategoryTab } from '@/components/site/category-tab'
import { TagTab } from '@/components/site/tag-tab'
import { WebContactTab } from '@/components/site/web-contact-tab'
import { FaqTab } from '@/components/site/faq-tab'
import { SiteHistoryTab } from '@/components/site/site-history-tab'
import { useAdminUser } from '@/store/auth.store'

const TABS = [
  { key: 'carousel', label: 'จัดการ Carousel' },
  { key: 'featured', label: 'นิยายแนะนำ' },
  { key: 'announcement', label: 'ประกาศ' },
  { key: 'category', label: 'หมวดหมู่' },
  { key: 'tag', label: 'หมวดหมู่ย่อย' },
  { key: 'web_contact', label: 'ช่องทางติดต่อ' },
  { key: 'faq', label: 'FAQ' },
  { key: 'history', label: 'ประวัติ' },
] as const
type TabKey = (typeof TABS)[number]['key']

export default function SitePage() {
  const me = useAdminUser()
  const myLevel = me?.level ?? 0
  const [tab, setTab] = useState<TabKey>('carousel')

  if (myLevel < 9) {
    return (
      <div>
        <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold text-foreground">
          <LayoutTemplate className="size-6" />
          ตั้งหน้าเว็บไซต์
        </h1>
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          ต้องเป็นแอดมินรองขึ้นไป (level ≥ 9) ถึงจะเข้าดูแท็บนี้ได้
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-6 flex items-center gap-2 text-2xl font-bold text-foreground">
        <LayoutTemplate className="size-6" />
        ตั้งหน้าเว็บไซต์
      </h1>

      <div className="mb-5 flex gap-2.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? 'cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground'
                : 'cursor-pointer rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'carousel' ? (
        <CarouselTab />
      ) : tab === 'featured' ? (
        <FeaturedTab />
      ) : tab === 'announcement' ? (
        <AnnouncementTab />
      ) : tab === 'category' ? (
        <CategoryTab />
      ) : tab === 'tag' ? (
        <TagTab />
      ) : tab === 'web_contact' ? (
        <WebContactTab />
      ) : tab === 'faq' ? (
        <FaqTab />
      ) : (
        <SiteHistoryTab />
      )}
    </div>
  )
}
