'use client'

/**
 * components/navbar/redeem-code-menu-item.tsx — รายการ "ใช้โค้ด" ในเมนูบัญชี (2026-08-18, ใหม่)
 *
 * แทนที่ลิงก์เดิมที่ชี้ไป /redeem-code (dead link ไม่เคยมีหน้าจริง) — กดแล้วเปิด RedeemCodeDialog
 * แทนการ navigate ไปหน้าใหม่ ตามที่ user ขอ ("เป็นหน้าต่างเด้งขึ้นมา")
 *
 * เมื่อมีโบนัส % เติมเงินค้างอยู่ (useActiveRedeemBonus) แถวนี้จะ highlight เป็น gradient
 * สีทองเหลืองออกส้ม พร้อมโชว์ % และเวลาที่เหลือ (นับเป็นวัน+ชม. เท่านั้น ไม่นับวินาที ตามที่ user ขอ) —
 * ใช้ทั้งใน dropdown เมนูบัญชีฝั่ง desktop (UserMenu) และ drawer เมนูฝั่ง mobile คนละ layout กัน
 * (mobile = icon+label+badge แบบเดียวกับรายการอื่นในลิ้นชัก, desktop = text link แบบเดียวกับ
 * MenuLink อื่นใน dropdown) เลยรับ prop `mobile` มาเลือก markup
 *
 * ⚠️ ตัว dialog ไม่ได้ถูก render/เก็บ state ไว้ในคอมโพเนนต์นี้เอง — ต้องยกไปให้ parent (UserMenu /
 * Navbar) ถือแทนผ่าน onOpenDialog เพราะปุ่มนี้อยู่ใน dropdown/drawer ที่ conditionally render แบบ
 * `{open && (...)}` พอกดแล้ว onNavigate() สั่งปิด dropdown ทันที (unmount ทั้ง subtree รวมปุ่มนี้)
 * ถ้า dialog state อยู่ในนี้ด้วยจะโดน unmount ไปพร้อมกันก่อนจะทันโชว์เลย (เจอบั๊กจริงตอนทดสอบ)
 */

import { KeyRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useActiveRedeemBonus } from '@/hooks/use-active-redeem-bonus'

function formatRemaining(expiresAt: string): string {
  const diffMs = new Date(expiresAt).getTime() - Date.now()
  if (diffMs <= 0) return ''
  const totalHours = Math.floor(diffMs / (60 * 60 * 1000))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return days > 0 ? `เหลือ ${days} วัน ${hours} ชม.` : `เหลือ ${hours} ชม.`
}

export function RedeemCodeMenuItem({
  mobile = false,
  onNavigate,
  onOpenDialog,
}: {
  mobile?: boolean
  onNavigate?: () => void
  onOpenDialog: () => void
}) {
  const { data: activeBonus } = useActiveRedeemBonus()

  const remaining = activeBonus ? formatRemaining(activeBonus.expires_at) : ''
  const isActive = Boolean(activeBonus && remaining)

  function handleClick() {
    onNavigate?.()
    onOpenDialog()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'w-full cursor-pointer text-left transition-colors',
        mobile
          ? 'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold'
          : 'block px-4 py-2 text-sm',
        isActive
          ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 text-white shadow-sm'
          : mobile
            ? 'text-muted-foreground hover:bg-accent hover:text-foreground'
            : 'text-foreground hover:bg-accent',
      )}
    >
      {mobile && <KeyRound className="size-5 shrink-0" />}
      <span className="flex-1">
        ใช้โค้ด
        {isActive && (
          <span className="block text-xs font-normal opacity-90">
            +{activeBonus!.percent}% · {remaining}
          </span>
        )}
      </span>
    </button>
  )
}
