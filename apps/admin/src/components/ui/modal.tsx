'use client'

import { X } from 'lucide-react'

const SIZE_CLASS = {
  sm: 'max-w-sm',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const

/**
 * Modal เบาๆ ทำเองล้วนๆ (ไม่พึ่ง Radix) — พอสำหรับ dialog ยืนยัน action ของแอป Admin
 * ที่มีแค่ไม่กี่จุด ไม่คุ้มเพิ่ม dependency ใหม่
 *
 * size เพิ่มเข้ามา 2026-08-03 สำหรับหน้าต่างรายละเอียดผู้ใช้ (ข้อมูล static+dynamic tab เยอะ
 * กว่า dialog ยืนยัน action ทั่วไปมาก max-w-sm เดิมแคบเกินไป) — default ยังเป็น 'sm' เหมือนเดิม
 * ไม่กระทบ Modal ที่มีอยู่แล้ว
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'sm',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: keyof typeof SIZE_CLASS
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className={`relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl ${SIZE_CLASS[size]}`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="cursor-pointer text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
