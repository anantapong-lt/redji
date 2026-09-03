'use client'

/**
 * components/purchase/redeem-history-section.tsx — "ประวัติการใช้โค้ด" (2026-08-18, ใหม่)
 *
 * ต่อกับ GET /redeem-codes/history (getMyRedeemHistory()) — ครอบคลุมทั้ง 3 ประเภทโค้ด
 * (instant_coins/topup_bonus_percent/referral) ที่ user เคยกรอกผ่านปุ่ม "ใช้โค้ด" ในเนวบาร์
 *
 * โชว์ coins_credited (join จาก coin_ledger จริง) แทน value ดิบเสมอ — value ของ referral คือ %
 * ค่าคอมมิชชั่นของ "เจ้าของโค้ด" ไม่ใช่เหรียญที่ตัวเอง (ผู้กรอก) ได้รับ โชว์ value ตรงๆ จะผิด (ดู
 * comment เต็มที่ RedeemHistoryRow ใน types/index.ts)
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Ticket } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { formatThaiDateTime } from '@/lib/utils'
import type { RedeemHistoryRow } from '@/types'

const PAGE_SIZE = 10

const TYPE_LABEL: Record<RedeemHistoryRow['type'], string> = {
  instant_coins: 'เติมเหรียญทันที',
  topup_bonus_percent: 'โบนัสเติมเงิน',
  referral: 'โค้ดชวนเพื่อน',
}

function statusDisplay(row: RedeemHistoryRow): { label: string; className: string } {
  if (row.status === 'pending') return { label: `รอใช้สิทธิ์ (หมดเขต ${formatThaiDateTime(row.expires_at!)})`, className: 'bg-amber-50 text-amber-700' }
  if (row.status === 'expired') return { label: 'หมดเขตแล้ว', className: 'bg-muted text-muted-foreground' }
  if (row.status === 'active') return { label: 'ใช้งานอยู่', className: 'bg-emerald-50 text-emerald-700' }
  return { label: 'ใช้สิทธิ์แล้ว', className: 'bg-emerald-50 text-emerald-700' }
}

function coinsLabel(row: RedeemHistoryRow): string {
  if (row.coins_credited === null) {
    // topup_bonus_percent ที่ยังไม่ถูกใช้ — ยังไม่มีเหรียญเข้าจริง โชว์ % ที่จะได้แทน
    return `+${Number(row.value)}%`
  }
  return `+${Number(row.coins_credited).toLocaleString()}`
}

export function RedeemHistorySection() {
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['redeem-codes', 'history', page],
    queryFn: () =>
      api.get<{
        data: RedeemHistoryRow[]
        pagination: { page: number; limit: number; total: number; pages: number }
      }>(`/redeem-codes/history?page=${page}&limit=${PAGE_SIZE}`),
  })

  const rows = query.data?.data ?? []
  const pagination = query.data?.pagination

  return (
    <div>
      <div className="flex flex-col gap-3">
        {query.isLoading ? (
          Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <Skeleton className="size-10 shrink-0 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-14" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">ยังไม่มีประวัติการใช้โค้ด</p>
        ) : (
          rows.map((row) => {
            const status = statusDisplay(row)
            return (
              <div key={row.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Ticket className="size-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{row.code}</p>
                  <p className="truncate text-sm text-muted-foreground">{TYPE_LABEL[row.type]}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatThaiDateTime(row.redeemed_at)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="font-bold text-amber-600">{coinsLabel(row)}</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${status.className}`}>
                    {status.label}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {pagination && pagination.pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            aria-label="หน้าก่อนหน้า"
            className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-border disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span>หน้า {pagination.page} / {pagination.pages}</span>
          <button
            type="button"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => p + 1)}
            aria-label="หน้าถัดไป"
            className="flex size-9 cursor-pointer items-center justify-center rounded-[10px] border border-border disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
