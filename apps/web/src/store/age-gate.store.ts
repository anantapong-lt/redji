'use client'

/**
 * store/age-gate.store.ts — เตือนเนื้อหา 18+ (2026-07-30)
 *
 * user ขอ: "ขึ้นมาว่าเนื้อหาต่อไปนี้เหมาะกับอายุ 18 ปี แล้วมีปุ่มให้กดปิด แล้วก็ไม่แสดงอีก"
 * — เป็นแค่คำเตือนให้กดยืนยันเอง (self-declare) ไม่ใช่การยืนยันอายุจริง (ไม่เช็ควันเกิด/บัตร)
 * โชว์ครั้งแรกที่เจอนิยาย/ตอนที่ age_rate = '18+' เท่านั้น แล้วจำไว้ในเบราว์เซอร์นี้ตลอดไป
 * (persist ผ่าน localStorage ระดับเบราว์เซอร์ ไม่ผูกกับบัญชี login เพราะ guest ก็ต้องเห็นคำเตือน
 * นี้ได้เหมือนกัน ไม่ต้อง login ก่อนถึงจะอ่านการ์ตูน/นิยาย 18+ ได้อยู่แล้ว)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AgeGateState {
  confirmed: boolean
  confirm: () => void
}

export const useAgeGateStore = create<AgeGateState>()(
  persist(
    (set) => ({
      confirmed: false,
      confirm: () => set({ confirmed: true }),
    }),
    { name: 'age-gate-storage' },
  ),
)
