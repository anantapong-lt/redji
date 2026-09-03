'use client'

/**
 * app/(main)/purchase-history/page.tsx — "ประวัติการซื้อ" (2026-08-18, ใหม่)
 *
 * เดิมเป็น dead link (ลิงก์ไว้ในเนวบาร์/ฟุตเตอร์แล้วแต่ยังไม่เคยมีหน้าจริง เหมือน /topup ก่อนหน้านี้)
 * — user ขอให้เป็นหน้าลิสต์ประวัติซื้อตอน (เรื่อง/ตอน/วันที่) พร้อมแท็บประวัติการเติมเหรียญแยกต่างหาก
 *
 * แท็บ "ประวัติการเติมเหรียญ" ใช้ TopupHistorySection ตัวเดียวกับที่แปะอยู่ท้ายหน้า /topup อยู่แล้ว
 * เป๊ะ (component เดิม ไม่ได้ copy โค้ด) ตามที่ user ระบุว่า "ทำหน้าที่เหมือนกัน" — /topup ยังคงมีของ
 * มันเองไว้เหมือนเดิม เพราะอยู่บริบทที่ต่างกัน (เพิ่งเติมเงินเสร็จอยากเห็นผลทันที ไม่ต้องสลับหน้า)
 *
 * แท็บ "ประวัติการใช้โค้ด" เพิ่มทีหลัง (2026-08-18) ตาม user ขอ — ดู RedeemHistorySection
 *
 * ต้อง login ถึงเข้าได้ — อยู่ใน USER_ROUTES ของ proxy.ts อยู่แล้วตั้งแต่แรก (ก่อนหน้านี้แค่ยังไม่มี
 * หน้าจริงให้เด้งไป)
 *
 * max-w-[1280px] — เดิมใช้ 800px (แนวเดียวกับ /settings) แต่ user ทักว่าแคบไป (เจอปัญหาเดียวกันมาแล้ว
 * ที่ /contact-admin) ขยับมาใช้ความกว้างเดียวกับหน้าคอนเทนต์กว้างอื่นๆ ของเว็บแทน
 */

import { useState } from 'react'
import { ShoppingBag, Coins, Ticket } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PurchaseHistorySection } from '@/components/purchase/purchase-history-section'
import { TopupHistorySection } from '@/components/topup/topup-history-section'
import { RedeemHistorySection } from '@/components/purchase/redeem-history-section'

const TABS = [
  { key: 'purchase', label: 'ประวัติการซื้อ', icon: ShoppingBag },
  { key: 'topup', label: 'ประวัติการเติมเหรียญ', icon: Coins },
  { key: 'redeem', label: 'ประวัติการใช้โค้ด', icon: Ticket },
] as const
type TabKey = (typeof TABS)[number]['key']

export default function PurchaseHistoryPage() {
  const [tab, setTab] = useState<TabKey>('purchase')

  return (
    <div className="mx-auto max-w-[1280px] px-8 py-10">
      <h1 className="mb-2 text-[32px] font-bold text-primary">ประวัติการซื้อ</h1>
      <p className="mb-6 text-sm text-muted-foreground">ตอนที่ซื้อไปแล้ว, ประวัติการเติมเหรียญ และประวัติการใช้โค้ดทั้งหมด</p>

      <div className="mb-6 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors',
              tab === t.key
                ? 'bg-primary text-primary-foreground'
                : 'border border-[#d9d9d9] bg-white text-foreground hover:bg-muted',
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'purchase' ? <PurchaseHistorySection /> : tab === 'topup' ? <TopupHistorySection embedded /> : <RedeemHistorySection />}
    </div>
  )
}
