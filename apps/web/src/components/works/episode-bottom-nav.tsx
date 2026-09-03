'use client'

import type { EpisodeToc } from '@/lib/mock-work-detail'

export function EpisodeBottomNav({
  episodes,
  currentEpNo,
  onNavigate,
}: {
  episodes: EpisodeToc[]
  currentEpNo: number
  // 2026-08-05 เปลี่ยนจาก Link href ตรงๆ เป็น callback — ต้องให้ episode-reader-client.tsx เช็คก่อน
  // ว่าตอนเป้าหมายต้องซื้อไหม ถ้าต้องซื้อให้เปิด modal ยืนยันโดยไม่ navigate ไปก่อน (กันเจอหน้าตัน
  // ที่ต้องกดย้อนกลับเพิ่มอีกที ตามที่ user บอกว่าอยากให้ "กดตอนถัดไป" ลื่นๆ ไม่กี่คลิกจบ)
  onNavigate: (epNo: number) => void
}) {
  const sorted = [...episodes].sort((a, b) => a.ep_no - b.ep_no)
  const currentIndex = sorted.findIndex((ep) => ep.ep_no === currentEpNo)
  const prevEp = currentIndex > 0 ? sorted[currentIndex - 1] : null
  const nextEp = currentIndex >= 0 && currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null

  return (
    <div className="flex h-14 w-full">
      {prevEp ? (
        <button
          type="button"
          onClick={() => onNavigate(prevEp.ep_no)}
          className="flex flex-[2] cursor-pointer items-center justify-center bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          ตอนก่อนหน้า
        </button>
      ) : (
        <span className="flex flex-[2] cursor-not-allowed items-center justify-center bg-muted px-4 text-sm font-medium text-muted-foreground">
          ตอนก่อนหน้า
        </span>
      )}
      {nextEp ? (
        <button
          type="button"
          onClick={() => onNavigate(nextEp.ep_no)}
          className="flex flex-[3] cursor-pointer items-center justify-center bg-primary/15 px-4 text-sm font-medium text-primary hover:bg-primary/20"
        >
          ตอนต่อไป
        </button>
      ) : (
        <span className="flex flex-[3] cursor-not-allowed items-center justify-center bg-muted px-4 text-sm font-medium text-muted-foreground">
          ตอนต่อไป (ตอนสุดท้าย)
        </span>
      )}
    </div>
  )
}
