'use client'

/**
 * app/(writer)/writer/withdraw/page.tsx — หน้า "ถอนเงิน" (2026-08-06, ใหม่)
 *
 * อิงจาก pdf อ้างอิงที่ user ส่งมา ("คำขอถอนเงิน - ReadToon Creator") — 3 การ์ดสรุปยอดด้านบน +
 * ตารางประวัติการถอน + ปุ่ม "ถอนเงิน"/"ขอเปลี่ยนข้อมูลธนาคาร" เปิด modal คนละอัน
 *
 * ตัดระบบถอนเป็นคอยน์ทิ้งทั้งหมดตามที่ user ขอ (โอนเข้าบัญชีธนาคารอย่างเดียว) เลยไม่มีคอลัมน์
 * "ประเภท" ในตารางเหมือน pdf ต้นแบบ (มีแค่ประเภทเดียวอยู่แล้ว โชว์ไปก็ไม่มีความหมาย)
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Wallet, Clock3, PiggyBank } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getBankName } from '@/lib/thai-banks'
import { formatThaiDateTime } from '@/lib/utils'
import { api } from '@/lib/api'
import { WithdrawRequestModal } from '@/components/writer/withdraw-request-modal'
import { BankChangeRequestModal } from '@/components/writer/bank-change-request-modal'

const PAGE_SIZE = 10

interface ApiWithdrawOverview {
  available_balance: number
  pending_amount: number
  pending_count: number
  total_withdrawn: number
}

interface ApiWithdrawalRow {
  id: string
  amount: string
  fee_amount: string
  net_amount: string
  bank_code: string
  account_name: string
  account_number: string
  status: 'pending' | 'approved' | 'rejected'
  reason: string | null
  approved_at: string | null
  created_at: string
}

interface ApiWithdrawalHistory {
  data: ApiWithdrawalRow[]
  pagination: { page: number; limit: number; total: number; pages: number }
}

function formatBaht(n: number | string): string {
  return `฿${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'รอดำเนินการ',
  approved: 'สำเร็จ',
  rejected: 'ปฏิเสธ',
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-destructive/10 text-destructive',
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  iconClassName,
}: {
  icon: typeof Wallet
  label: string
  value: string
  sub?: string
  iconClassName: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[15px] border border-dashed border-border p-4">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconClassName}`}>
        <Icon className="size-5" />
      </div>
    </div>
  )
}

export default function WithdrawPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [page, setPage] = useState(1)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [bankChangeOpen, setBankChangeOpen] = useState(false)

  const overviewQuery = useQuery({
    queryKey: ['writer', 'withdrawals', 'overview'],
    queryFn: () => api.get<{ data: ApiWithdrawOverview }>('/writer/withdrawals/overview').then((r) => r.data),
  })

  const historyQuery = useQuery({
    queryKey: ['writer', 'withdrawals', 'history', status, page],
    queryFn: () =>
      api.get<ApiWithdrawalHistory>(
        `/writer/withdrawals?page=${page}&limit=${PAGE_SIZE}${status !== 'all' ? `&status=${status}` : ''}`,
      ),
  })

  const overview = overviewQuery.data
  const rows = historyQuery.data?.data ?? []
  const pagination = historyQuery.data?.pagination

  function handleSuccess() {
    queryClient.invalidateQueries({ queryKey: ['writer', 'withdrawals'] })
    queryClient.invalidateQueries({ queryKey: ['writer', 'dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['writer', 'bank-info'] })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">คำขอถอนเงิน</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBankChangeOpen(true)}>
            ขอเปลี่ยนข้อมูลธนาคาร
          </Button>
          <Button onClick={() => setWithdrawOpen(true)}>ถอนเงิน</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={Wallet}
          label="ยอดเงินคงเหลือ"
          value={overview ? formatBaht(overview.available_balance) : '—'}
          iconClassName="bg-primary/10 text-primary"
        />
        <StatCard
          icon={Clock3}
          label="รอดำเนินการ"
          value={overview ? formatBaht(overview.pending_amount) : '—'}
          sub={overview ? `${overview.pending_count} รายการ` : undefined}
          iconClassName="bg-amber-50 text-amber-600"
        />
        <StatCard
          icon={PiggyBank}
          label="ถอนเงินทั้งหมด"
          value={overview ? formatBaht(overview.total_withdrawn) : '—'}
          iconClassName="bg-emerald-50 text-emerald-600"
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-foreground">ประวัติการถอนเงิน</h2>
          <div className="w-40">
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as typeof status)
                setPage(1)
              }}
            >
              <SelectTrigger className="!h-9 w-full border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">สถานะทั้งหมด</SelectItem>
                <SelectItem value="pending">รอดำเนินการ</SelectItem>
                <SelectItem value="approved">สำเร็จ</SelectItem>
                <SelectItem value="rejected">ปฏิเสธ</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">เมื่อ</th>
                <th className="px-4 py-3 font-medium">ธนาคาร</th>
                <th className="px-4 py-3 font-medium">บัญชี</th>
                <th className="px-4 py-3 font-medium">จำนวนเงิน</th>
                <th className="px-4 py-3 font-medium">ยอดที่จะได้รับ</th>
                <th className="px-4 py-3 font-medium">สถานะ</th>
                <th className="px-4 py-3 font-medium">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {historyQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    ยังไม่มีประวัติการถอนเงิน
                  </td>
                </tr>
              ) : (
                rows.map((w) => (
                  <tr key={w.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatThaiDateTime(w.created_at)}
                    </td>
                    <td className="px-4 py-3">{getBankName(w.bank_code)}</td>
                    <td className="px-4 py-3">
                      <div className="text-foreground">{w.account_name}</div>
                      <div className="text-xs text-muted-foreground">{w.account_number}</div>
                    </td>
                    <td className="px-4 py-3">{formatBaht(w.amount)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{formatBaht(w.net_amount)}</div>
                      {Number(w.fee_amount) > 0 && (
                        <div className="text-xs text-muted-foreground">ค่าดำเนินการ -{formatBaht(w.fee_amount)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[w.status]}`}>
                        {STATUS_LABEL[w.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-48 text-xs text-muted-foreground">{w.reason ?? '-'}</td>
                  </tr>
                ))
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
            <span>
              แสดง {rows.length} จาก {pagination.total} รายการ · หน้า {pagination.page} / {pagination.pages}
            </span>
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

      <WithdrawRequestModal
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        availableBalance={overview?.available_balance ?? 0}
        onSuccess={handleSuccess}
      />
      <BankChangeRequestModal open={bankChangeOpen} onOpenChange={setBankChangeOpen} onSuccess={handleSuccess} />
    </div>
  )
}
