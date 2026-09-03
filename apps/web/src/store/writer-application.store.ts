'use client'

/**
 * store/writer-application.store.ts — เก็บแค่ "ยืนยันข้อตกลงแล้วหรือยัง" (2026-07-30, แก้รอบ 3)
 *
 * เดิม store นี้เก็บทั้ง submitted/data แบบ mock (localStorage ล้วนๆ) — ตอนนี้ต่อ backend จริงแล้ว
 * ผ่าน GET/POST /users/me/writer-application (ดู hooks/use-writer-application.ts) เลยเหลือแค่
 * onboardingConfirmed ที่ยังเหมาะเป็น client-only state ต่อไป (เป็นแค่ "เคยกดยอมรับ modal
 * onboarding ในเบราว์เซอร์นี้หรือยัง" ไม่ใช่ข้อมูลที่มีความหมายฝั่ง server เลย)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface WriterOnboardingState {
  confirmedByUuid: Record<string, boolean>
  confirmOnboarding: (uuid: string) => void
}

export const useWriterOnboardingStore = create<WriterOnboardingState>()(
  persist(
    (set) => ({
      confirmedByUuid: {},
      confirmOnboarding: (uuid) =>
        set((s) => ({ confirmedByUuid: { ...s.confirmedByUuid, [uuid]: true } })),
    }),
    { name: 'writer-onboarding-storage' },
  ),
)

export function useOnboardingConfirmed(uuid: string | undefined) {
  return useWriterOnboardingStore((s) => (uuid ? Boolean(s.confirmedByUuid[uuid]) : false))
}
