'use client'

/**
 * store/visited-episodes.store.ts — จำตอนที่เคยกดเข้าไปแล้ว (2026-08-05)
 *
 * user ขอ: จุดแดง "ตอนใหม่" ในสารบัญ ต้องหายไปทันทีที่กดเข้าไป "แม้อ่านไม่ได้" (โดนกันด้วยระบบซื้อตอน)
 * — คนละสัญญาณกับ is_read จาก backend (อันนั้นยืนยันว่าอ่านเนื้อหาจริงแล้วเท่านั้น ไม่ครอบคลุมเคส
 * กดเข้าไปแล้วเจอหน้าต้องซื้อก่อน) เก็บเป็น set ของ "workUuid:epNo" ที่เคยคลิกเข้าไป persist ผ่าน
 * localStorage ระดับเบราว์เซอร์เหมือน age-gate/purchase-confirm (ไม่ผูกบัญชี login)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface VisitedEpisodesState {
  visited: Record<string, true>
  markVisited: (workUuid: string, epNo: number) => void
}

export const useVisitedEpisodesStore = create<VisitedEpisodesState>()(
  persist(
    (set) => ({
      visited: {},
      markVisited: (workUuid, epNo) =>
        set((state) => {
          const key = `${workUuid}:${epNo}`
          if (state.visited[key]) return state
          return { visited: { ...state.visited, [key]: true } }
        }),
    }),
    { name: 'visited-episodes-storage' },
  ),
)

export function isEpisodeVisited(visited: Record<string, true>, workUuid: string, epNo: number): boolean {
  return Boolean(visited[`${workUuid}:${epNo}`])
}
