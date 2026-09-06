'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Banknote, BarChart3, BookOpen, Eye, FileText, PenSquare, ShoppingCart, Users } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TopupStatus } from '@/constants/topup.constant'
import { useAdminAuth } from '@/components/admin-auth-provider'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

interface DashboardData {
  selected_period: { year: number; month: number }
  stats: Record<
    'user_count' | 'writer_count' | 'story_count' | 'chapter_count' | 'total_views' | 'topup_total' | 'purchase_total',
    string
  >
  topup_chart: { date: string; amount: string }[]
  recent_topups: { id: string; username: string; amount: string; status: TopupStatus; created_at: string }[]
  recent_transactions: {
    id: string
    type: 'topup' | 'purchase'
    description: string
    username: string
    amount: string
    created_at: string
  }[]
}

const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const monthLabels = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]
const numberFormatter = new Intl.NumberFormat('th-TH')
const moneyFormatter = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const topupStatusLabels: Record<TopupStatus, string> = {
  [TopupStatus.PENDING]: 'รอดำเนินการ',
  [TopupStatus.PAID]: 'สำเร็จ',
  [TopupStatus.EXPIRED]: 'หมดอายุ',
  [TopupStatus.FAILED]: 'ไม่สำเร็จ',
}

function formatNumber(value: string) {
  return numberFormatter.format(Number(value))
}
function formatMoney(value: string) {
  return moneyFormatter.format(Number(value))
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
function chartDateLabel(value: string) {
  return new Intl.DateTimeFormat('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' }).format(
    new Date(`${value}T00:00:00+07:00`),
  )
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  money = false,
}: {
  title: string
  value?: string
  icon: typeof Users
  money?: boolean
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          {value === undefined ? (
            <Skeleton className="mt-2 h-8 w-24" />
          ) : (
            <p className="mt-1 text-2xl font-semibold">{money ? formatMoney(value) : formatNumber(value)}</p>
          )}
        </div>
        <div className="rounded-lg bg-primary/10 p-3 text-primary">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

function TopupChart({ data }: { data: DashboardData['topup_chart'] }) {
  const chartData = data.map((item) => ({ label: chartDateLabel(item.date), amount: Number(item.amount) }))
  const total = chartData.reduce((sum, item) => sum + item.amount, 0)
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-1 text-2xl font-bold tabular-nums">
          <Banknote className="size-5 text-primary" />
          {formatMoney(String(total))}
        </p>
        <span className="pt-1 text-xs text-muted-foreground">บาท</span>
      </div>
      <div className="mt-4 h-56 w-full" role="img" aria-label="กราฟยอดเติมเงินรายวัน">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              minTickGap={24}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              width={52}
              tickFormatter={(value) => formatMoney(String(value))}
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{ borderRadius: 12, backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
              formatter={(value) => [formatMoney(String(value)), 'ยอดเติมเงิน']}
            />
            <Line
              type="monotone"
              dataKey="amount"
              stroke="var(--chart-3)"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function RecentTopups({ topups }: { topups: DashboardData['recent_topups'] }) {
  return (
    <div className="mt-6 border-t pt-5">
      <h3 className="font-bold">รายการเติมเงินล่าสุด</h3>
      {topups.length ? (
        <div className="mt-3 divide-y rounded-lg border">
          {topups.map((transaction) => (
            <div key={transaction.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm">@{transaction.username}</p>
                  <Badge
                    variant={
                      transaction.status === TopupStatus.PAID
                        ? 'secondary'
                        : transaction.status === TopupStatus.FAILED || transaction.status === TopupStatus.EXPIRED
                          ? 'destructive'
                          : 'outline'
                    }
                  >
                    {topupStatusLabels[transaction.status]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(transaction.created_at)}</p>
              </div>
              <span className="shrink-0 text-sm font-medium">{formatMoney(transaction.amount)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">ยังไม่มีรายการเติมเงิน</p>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const { accessToken } = useAdminAuth()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const years = useMemo(() => Array.from({ length: 5 }, (_, index) => now.getFullYear() - index), [now.getFullYear()])

  const loadDashboard = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${apiUrl}/admin/dashboard?year=${year}&month=${month}`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
        credentials: 'include',
      })
      const body = (await response.json().catch(() => null)) as DashboardData | { message?: string } | null
      if (!response.ok) throw new Error(body && 'message' in body ? body.message : 'ไม่สามารถโหลด Dashboard ได้')
      setData(body as DashboardData)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ไม่สามารถโหลด Dashboard ได้')
    } finally {
      setLoading(false)
    }
  }, [accessToken, month, year])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  return (
    <main className="mx-auto w-full space-y-6 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <BarChart3 className="size-6 text-primary" />
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">ภาพรวมระบบและธุรกรรมล่าสุด</p>
      </div>
      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryCard title="ผู้ใช้งาน" value={data?.stats.user_count} icon={Users} />
            <SummaryCard title="นักเขียน" value={data?.stats.writer_count} icon={PenSquare} />
            <SummaryCard title="ผลงาน" value={data?.stats.story_count} icon={BookOpen} />
            <SummaryCard title="ตอน" value={data?.stats.chapter_count} icon={FileText} />
            <SummaryCard title="ยอดเข้าชม" value={data?.stats.total_views} icon={Eye} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <SummaryCard title="ยอดเติมเงิน" value={data?.stats.topup_total} icon={Banknote} money />
            <SummaryCard title="ยอดซื้อตอน" value={data?.stats.purchase_total} icon={ShoppingCart} money />
          </div>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,1fr)]">
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>ยอดเติมเงินย้อนหลัง</CardTitle>
                <div className="flex gap-2">
                  <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((option) => (
                        <SelectItem key={option} value={String(option)}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthLabels.map((label, index) => (
                        <SelectItem key={label} value={String(index + 1)}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-64 w-full" /> : data && <TopupChart data={data.topup_chart} />}
                {!loading && data && <RecentTopups topups={data.recent_topups} />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>รายการซื้อตอนล่าสุด</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="space-y-4 p-6">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={index} className="h-10 w-full" />
                    ))}
                  </div>
                ) : data?.recent_transactions.length ? (
                  <div className="divide-y">
                    {data.recent_transactions.map((transaction) => (
                      <div
                        key={`${transaction.type}-${transaction.id}`}
                        className="flex items-center justify-between gap-3 p-4"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">ซื้อตอน</Badge>
                            <span className="truncate text-sm">{transaction.description}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            @{transaction.username} · {formatDate(transaction.created_at)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-medium">{formatMoney(transaction.amount)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-6 text-sm text-muted-foreground">ยังไม่มีรายการซื้อตอน</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </main>
  )
}
