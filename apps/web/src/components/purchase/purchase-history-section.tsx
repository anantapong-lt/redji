'use client'

/**
 * components/purchase/purchase-history-section.tsx — "ประวัติการซื้อ" (2026-08-18, ใหม่)
 *
 * ต่อกับ GET /purchase/history (getPurchaseHistory() — มีอยู่แล้วตั้งแต่ระบบซื้อตอนแรก แค่ไม่เคย
 * มี UI โชว์ผลลัพธ์) แต่ละแถวคือ 1 ep_shop record (1 ตอนที่ซื้อ) พร้อมปก/ชื่อเรื่อง/ชื่อตอน
 *
 * unoptimized={coverSrc.startsWith('/')} ตรงกับ pattern ของ NovelCard (components/home/
 * novel-card.tsx) — ปกจริงเป็น URL เต็มจาก storage ให้ Next/Image optimize ได้ตามปกติ ส่วน
 * placeholder เป็น local path (/novel-cover-placeholder.png) ต้อง unoptimized ไม่งั้น error
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Coins } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { formatThaiDateTime } from '@/lib/utils'
import type { PurchaseHistoryRow } from '@/types'

const PAGE_SIZE = 10

function accessLabel(row: PurchaseHistoryRow): { label: string; className: string } {
  if (!row.lock_after_datetime) return { label: 'อ่านได้ถาวร', className: 'bg-emerald-50 text-emerald-700' }
  if (row.is_expired) return { label: 'หมดอายุแล้ว', className: 'bg-muted text-muted-foreground' }
  return { label: `อ่านได้ถึง ${formatThaiDateTime(row.lock_after_datetime)}`, className: 'bg-amber-50 text-amber-700' }
}

export function PurchaseHistorySection() {
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['purchase', 'history', page],
    queryFn: () =>
      api.get<{
        data: PurchaseHistoryRow[]
        pagination: { page: number; limit: number; total: number; pages: number }
      }>(`/purchase/history?page=${page}&limit=${PAGE_SIZE}`),
  })

  const rows = query.data?.data ?? []
  const pagination = query.data?.pagination

  return (
    <div>
      <div className="flex flex-col gap-3">
        {query.isLoading ? (
          Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <Skeleton className="size-14 shrink-0 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-28" />
              </div>
              <Skeleton className="h-4 w-14" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">ยังไม่มีประวัติการซื้อ</p>
        ) : (
          rows.map((row) => {
            const access = accessLabel(row)
            const coverSrc = row.cover_image ?? '/novel-cover-placeholder.png'
            return (
              <Link
                key={row.id}
                href={`/works/${row.work_uuid}/read/${row.ep_no}`}
                className="flex items-center gap-3 rounded-xl border border-border p-3 transition-colors hover:border-primary/30 hover:bg-muted/30"
              >
                <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                  <Image
                    src={coverSrc}
                    alt={row.work_title}
                    fill
                    sizes="56px"
                    unoptimized={coverSrc.startsWith('/')}
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{row.work_title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    ตอนที่ {row.ep_no} · {row.ep_name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatThaiDateTime(row.created_at)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="flex items-center gap-1 font-bold text-amber-600">
                    <Coins className="size-3.5" />
                    {Number(row.price).toLocaleString()}
                  </span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${access.className}`}>
                    {access.label}
                  </span>
                </div>
              </Link>
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
