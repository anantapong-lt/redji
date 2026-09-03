'use client'

/**
 * components/topup/topup-history-section.tsx — "ประวัติการเติมเหรียญ" (2026-08-06, ใหม่)
 *
 * อ้างอิงภาพตัวอย่างที่ user ส่งมา (ตาราง วันที่/ประเภท/รหัสรายการ/รหัสอ้างอิง/สถานะ/จำนวนเหรียญ)
 * — แสดงผลอย่างเดียว ไม่มีปุ่ม action ใดๆ ตามที่ user ระบุ ("มีไว้เฉยๆ ขอคืนตังไม่ได้")
 *
 * รหัสรายการ = ref_id (รหัสภายในของเราเอง, TP-prefix, ไม่เปลี่ยนตลอดอายุ transaction)
 * รหัสอ้างอิง = transaction_id (รหัสฝั่ง "gateway" — ตอน pending จะเหมือน ref_id เป๊ะ พอ completed
 * แล้วจะถูกแทนที่ด้วยรหัสจริงจาก gateway/mock gateway)
 *
 * "หมดเวลา": schema เราไม่มีสถานะนี้จริง (มีแค่ pending/completed/failed/cancelled) แต่รายการที่
 * ยัง pending ค้างมานานมากๆ (เกิน 15 นาที — คร่าวๆ ตามอายุ QR ทั่วไป) ในทางปฏิบัติถือว่าหมดอายุ
 * ไปแล้วจริง ไม่มีทางจ่ายสำเร็จอีก — โชว์เป็น "หมดเวลา" แทน "รอดำเนินการ" เฉพาะตอนแสดงผลเท่านั้น
 * (ไม่ได้เปลี่ยน status จริงใน DB เลย เป็นแค่ label ฝั่ง frontend)
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Coins, Info } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { formatThaiDateTime } from '@/lib/utils'
import type { TopupHistoryRow } from '@/types'

const PAGE_SIZE = 10
const PENDING_EXPIRE_MS = 15 * 60 * 1000 // 15 นาที — ประมาณอายุ QR ทั่วไป

type StatusFilter = 'all' | 'pending' | 'completed' | 'failed' | 'cancelled'

function statusDisplay(row: TopupHistoryRow): { label: string; className: string } {
  if (row.status === 'completed') return { label: 'สำเร็จ', className: 'bg-emerald-50 text-emerald-700' }
  if (row.status === 'failed') return { label: 'ไม่สำเร็จ', className: 'bg-destructive/10 text-destructive' }
  if (row.status === 'cancelled') return { label: 'ยกเลิก', className: 'bg-muted text-muted-foreground' }

  // pending — เช็คว่าเก่าเกินไปจนถือว่าหมดเวลาไปแล้วหรือยัง
  const age = Date.now() - new Date(row.created_at).getTime()
  if (age >= PENDING_EXPIRE_MS) return { label: 'หมดเวลา', className: 'bg-muted text-muted-foreground' }
  return { label: 'รอดำเนินการ', className: 'bg-amber-50 text-amber-700' }
}

export function TopupHistorySection({ embedded = false }: { embedded?: boolean } = {}) {
  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)

  const query = useQuery({
    queryKey: ['topup', 'history', status, page],
    queryFn: () =>
      api.get<{
        data: TopupHistoryRow[]
        pagination: { page: number; limit: number; total: number; pages: number }
      }>(`/topup/history?page=${page}&limit=${PAGE_SIZE}${status !== 'all' ? `&status=${status}` : ''}`),
  })

  const rows = query.data?.data ?? []
  const pagination = query.data?.pagination

  return (
    <div className={embedded ? undefined : 'mt-10'}>
      {/* embedded = แปะอยู่ใต้แท็บที่มีชื่อ "ประวัติการเติมเหรียญ" อยู่แล้ว (หน้า /purchase-history)
          — ซ่อนหัวข้อซ้ำ + margin-top ที่ตั้งใจไว้สำหรับตอนต่อท้ายฟอร์มเติมเงินใน /topup เท่านั้น */}
      {!embedded && <h2 className="mb-3 text-xl font-bold text-foreground">ประวัติการเติมเหรียญ</h2>}

      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">แสดงรายการ</span>
        <div className="w-40">
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as StatusFilter)
              setPage(1)
            }}
          >
            <SelectTrigger className="!h-9 w-full border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="pending">รอดำเนินการ</SelectItem>
              <SelectItem value="completed">สำเร็จ</SelectItem>
              <SelectItem value="failed">ไม่สำเร็จ</SelectItem>
              <SelectItem value="cancelled">ยกเลิก</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* user ถามว่ารหัสอ้างอิงคือรหัสสลิปหรือเปล่า — ไม่ใช่ ทั้งสองคอลัมน์เป็นรหัสติดตามรายการ
          ของระบบเรา ไม่ใช่รหัสจากธนาคาร/สลิปเลย (ดู comment เต็มด้านบนไฟล์นี้) โน้ตอธิบายสั้นๆ
          ให้เห็นตรงหน้าเพจเลยตามที่ user ขอ ไม่ต้องเปิดโค้ดมาอ่าน */}
      <p className="mb-3 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        รหัสรายการ/รหัสอ้างอิง เป็นรหัสติดตามรายการภายในระบบเรา ไม่ใช่รหัสสลิปธนาคาร — รหัสอ้างอิง
        จะเหมือนรหัสรายการจนกว่ารายการจะสำเร็จ (ตอนนี้ยังไม่ได้ต่อผู้ให้บริการชำระเงินจริง เลยเป็น
        รหัสจำลองไปก่อน)
      </p>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium whitespace-nowrap">วันที่/เวลา</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">ประเภทรายการ</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">รหัสรายการ</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">รหัสอ้างอิง</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">สถานะรายการ</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">
                <span className="flex items-center gap-1">
                  <Coins className="size-3.5 text-amber-500" />
                  จำนวนเหรียญ
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              Array.from({ length: 4 }, (_, index) => (
                <tr key={index} className="border-b border-border last:border-0">
                  {Array.from({ length: 6 }, (_, cell) => (
                    <td key={cell} className="px-4 py-3">
                      <Skeleton className={cell === 0 ? 'h-4 w-24' : cell === 5 ? 'ml-auto h-4 w-12' : 'h-4 w-20'} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  ยังไม่มีประวัติการเติมเหรียญ
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const s = statusDisplay(row)
                return (
                  <tr key={row.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatThaiDateTime(row.created_at)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">เติมเหรียญ</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{row.ref_id}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{row.transaction_id}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.className}`}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-amber-600">{Number(row.coins_added).toFixed(2)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
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
