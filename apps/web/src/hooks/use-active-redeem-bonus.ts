'use client'

/**
 * hooks/use-active-redeem-bonus.ts — โบนัส % เติมเงินที่กำลังรอใช้อยู่ (2026-08-18)
 *
 * ใช้ทั้งจากปุ่ม "ใช้โค้ด" ในเนวบาร์ (โชว์ highlight สีทองเหลืองออกส้ม + % + เวลาที่เหลือ) และจาก
 * RedeemCodeDialog (invalidate query นี้หลังแลกโค้ด bonus สำเร็จ ให้ navbar อัปเดตทันทีไม่ต้อง reload)
 * refetchInterval ตั้งไว้ห่างๆ (5 นาที) เพราะ user ขอให้แสดงผลแค่ระดับวัน/ชม. ไม่ใช่นาฬิกานับถอยหลัง
 * วินาทีต่อวินาที ไม่จำเป็นต้อง poll ถี่
 */

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useIsLoggedIn } from '@/store/auth.store'

export interface ActiveRedeemBonus {
  percent: number
  expires_at: string
}

export function useActiveRedeemBonus() {
  const isLoggedIn = useIsLoggedIn()

  return useQuery({
    queryKey: ['redeem-codes', 'active-bonus'],
    queryFn: () => api.get<{ data: ActiveRedeemBonus | null }>('/redeem-codes/active-bonus').then((res) => res.data),
    enabled: isLoggedIn,
    staleTime: 60_000,
    refetchInterval: isLoggedIn ? 5 * 60_000 : false,
  })
}
