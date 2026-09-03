'use client'

/**
 * components/works/numbered-pagination.tsx — ตัวเลื่อนหน้าแบบตัวเลข (2026-08-05, ใหม่)
 *
 * user ขอ: ลูกศรซ้าย-ขวา + เลขหน้า จำกัดโชว์สูงสุด 9 เลข เลื่อนตามหน้าปัจจุบันให้อยู่กลางๆ
 * (พยายามมีอย่างน้อย 4 ตัวซ้าย-ขวาของหน้าปัจจุบัน ถ้าไม่มีพอ (ใกล้ขอบ) ก็ชิดขอบไปเลย) —
 * ตัวอย่างที่ user ให้: หน้า 9 จากทั้งหมด >9 หน้า → โชว์ 5 6 7 8 9 10 11 12 13
 *
 * อัลกอริทึม: เริ่มจาก currentPage-4 แล้ว clamp ทั้งสองข้างด้วย 1/totalPages แล้ว re-adjust
 * จุดเริ่มอีกทีถ้าปลายทางโดน clamp (กันหน้าต่างเลื่อนสั้นกว่า 9 ตอนอยู่ใกล้ปลายทั้งที่ยังมีที่ว่าง
 * ให้ขยายฝั่งตรงข้ามได้)
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const MAX_VISIBLE = 9
const SIDE_SPAN = 4 // อยากได้ 4 ตัวซ้าย/ขวาของหน้าปัจจุบัน (รวมหน้าปัจจุบัน = 9)

function getVisiblePages(current: number, total: number): number[] {
  if (total <= MAX_VISIBLE) return Array.from({ length: total }, (_, i) => i + 1)

  let start = Math.max(1, current - SIDE_SPAN)
  let end = Math.min(total, start + MAX_VISIBLE - 1)
  start = Math.max(1, end - MAX_VISIBLE + 1)

  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

export function NumberedPagination({
  page,
  totalPages,
  onPageChange,
  className,
}: {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}) {
  if (totalPages <= 1) return null

  const visible = getVisiblePages(page, totalPages)

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <button
        type="button"
        aria-label="หน้าก่อนหน้า"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronLeft className="size-4" />
      </button>

      {visible.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          aria-current={p === page ? 'page' : undefined}
          className={cn(
            'flex size-7 cursor-pointer items-center justify-center rounded-md text-xs font-medium',
            p === page ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {p}
        </button>
      ))}

      <button
        type="button"
        aria-label="หน้าถัดไป"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}
