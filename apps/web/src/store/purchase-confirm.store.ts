'use client'

/**
 * store/purchase-confirm.store.ts — "ไม่ต้องถามอีก 7 วัน" ตอนซื้อตอน (2026-08-05)
 *
 * user ขอ: modal ยืนยันซื้อตอน (แน่ใจใช่ไหมว่าจะซื้อ...) ต้องมีติ๊กให้ข้ามการถามได้ 7 วัน เผื่อใคร
 * รำคาญที่ต้องยืนยันทุกตอน — เก็บเป็น timestamp ที่จะหมดอายุ (ไม่ใช่ boolean ค้างตลอดไปแบบ
 * age-gate.store.ts เพราะอันนี้ต้อง "หมดอายุ" กลับมาถามใหม่หลัง 7 วัน) persist ผ่าน localStorage
 * ระดับเบราว์เซอร์เหมือน age-gate (ไม่ผูกกับบัญชี login เพราะเป็นความสะดวกส่วนเบราว์เซอร์ ไม่ใช่
 * การตั้งค่าบัญชี)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const SKIP_DURATION_MS = 7 * 24 * 60 * 60 * 1000

interface PurchaseConfirmState {
  skipUntil: number | null
  skipFor7Days: () => void
}

export const usePurchaseConfirmStore = create<PurchaseConfirmState>()(
  persist(
    (set) => ({
      skipUntil: null,
      skipFor7Days: () => set({ skipUntil: Date.now() + SKIP_DURATION_MS }),
    }),
    { name: 'purchase-confirm-storage' },
  ),
)

export function shouldSkipPurchaseConfirm(skipUntil: number | null): boolean {
  return skipUntil !== null && Date.now() < skipUntil
}
