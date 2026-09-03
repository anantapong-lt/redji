'use client'

/**
 * components/works/work-analytics-tab.tsx — แท็บ "สถิติเจาะลึก" ในหน้าแก้ผลงาน (admin, 2026-08-05)
 *
 * พอร์ตมาจาก apps/web/src/components/writer/work-analytics-tab.tsx ตรงๆ (user ขอให้แอดมินดูสถิติ
 * ผลงานได้แบบเดียวกับที่นักเขียนเห็นเอง) ต่างกันแค่ 2 จุด: ยิง /admin/works/:uuid/stats... แทน
 * /writer/works/:uuid/stats... (ดู admin-works.service.ts — delegate ไปที่ writer.service.ts
 * ฟังก์ชันเดียวกันโดยสวม author_id ของเจ้าของจริง) และใช้ <Select> แบบ native <select> ของ
 * apps/admin แทน Radix compound component ของฝั่ง web
 *
 * ⚠️ ข้อจำกัดข้อมูลเดียวกับต้นฉบับ: กราฟนับจาก work_ep_views ซึ่งบันทึกเฉพาะ user ที่ login อ่าน
 * เท่านั้น (guest ไม่ถูกนับ) ยอดในกราฟเลยอาจน้อยกว่ายอดวิวรวมจริงที่การ์ดบนสุดโชว์ — ดู
 * KNOWN_ISSUES.md
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, Heart, Bookmark, MessageCircle, ListOrdered } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { api } from '@/lib/api'
import { Select } from '@/components/ui/select'
import { formatEpisodeTitle } from '@/lib/episode-format'
import { formatCompactNumber } from '@/lib/utils'

interface ApiWorkStats {
  view_count: number
  like_count: number
  bookmark_count: number
  comment_count: number
}

interface ApiMonthlyViews {
  daily: { day: number; views: number }[]
  total: number
}

interface ApiYearlyViews {
  monthly: { month: number; views: number }[]
  total: number
}

interface ApiTopEpisode {
  ep_id: string
  ep_no: number
  ep_name: string
  episode_label: string | null
  views: number
}

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)

function StatCard({
  icon: Icon,
  label,
  value,
  iconClassName,
}: {
  icon: typeof Eye
  label: string
  value: string
  iconClassName: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[15px] border border-dashed border-border p-4">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
      </div>
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconClassName}`}>
        <Icon className="size-5" />
      </div>
    </div>
  )
}

export function WorkAnalyticsTab({ workUuid }: { workUuid: string }) {
  const now = new Date()
  const [monthlyMonth, setMonthlyMonth] = useState(now.getMonth() + 1)
  const [monthlyYear, setMonthlyYear] = useState(now.getFullYear())
  const [yearlyYear, setYearlyYear] = useState(now.getFullYear())

  const stats = useQuery({
    queryKey: ['admin', 'work', workUuid, 'stats'],
    queryFn: () => api.get<{ data: ApiWorkStats }>(`/admin/works/${workUuid}/stats`).then((res) => res.data),
  })

  const monthly = useQuery({
    queryKey: ['admin', 'work', workUuid, 'stats', 'monthly', monthlyYear, monthlyMonth],
    queryFn: () =>
      api
        .get<{ data: ApiMonthlyViews }>(`/admin/works/${workUuid}/stats/monthly?year=${monthlyYear}&month=${monthlyMonth}`)
        .then((res) => res.data),
  })

  const yearly = useQuery({
    queryKey: ['admin', 'work', workUuid, 'stats', 'yearly', yearlyYear],
    queryFn: () =>
      api.get<{ data: ApiYearlyViews }>(`/admin/works/${workUuid}/stats/yearly?year=${yearlyYear}`).then((res) => res.data),
  })

  const topEpisodes = useQuery({
    queryKey: ['admin', 'work', workUuid, 'stats', 'top-episodes'],
    queryFn: () =>
      api.get<{ data: ApiTopEpisode[] }>(`/admin/works/${workUuid}/stats/top-episodes`).then((res) => res.data),
  })

  const monthlyChartData = (monthly.data?.daily ?? []).map((d) => ({ label: String(d.day), views: d.views }))
  const yearlyChartData = (yearly.data?.monthly ?? []).map((m) => ({ label: THAI_MONTHS_FULL[m.month - 1].slice(0, 3), views: m.views }))

  return (
    <div className="flex flex-col gap-6">
      {stats.isLoading || !stats.data ? (
        <p className="py-4 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Eye} label="จำนวนยอดวิว" value={formatCompactNumber(stats.data.view_count)} iconClassName="bg-amber-500/15 text-amber-500" />
          <StatCard icon={Heart} label="จำนวนคนชื่นชอบ" value={formatCompactNumber(stats.data.like_count)} iconClassName="bg-pink-500/15 text-pink-500" />
          <StatCard icon={Bookmark} label="จำนวน Bookmark" value={formatCompactNumber(stats.data.bookmark_count)} iconClassName="bg-primary/15 text-primary" />
          <StatCard icon={MessageCircle} label="จำนวน Comment" value={formatCompactNumber(stats.data.comment_count)} iconClassName="bg-sky-500/15 text-sky-500" />
        </div>
      )}

      {/* กราฟยอดวิวรายวัน (เลือกเดือน/ปี) */}
      <div className="rounded-[15px] border border-border p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-foreground">รายงานยอดวิวรายเดือน</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">ข้อมูลประจำเดือน :</span>
            <Select
              className="h-8 w-32 text-xs"
              value={String(monthlyMonth)}
              onChange={(e) => setMonthlyMonth(Number(e.target.value))}
            >
              {THAI_MONTHS_FULL.map((m, i) => (
                <option key={m} value={String(i + 1)}>{m}</option>
              ))}
            </Select>
            <span className="text-xs text-muted-foreground">ปี :</span>
            <Select
              className="h-8 w-20 text-xs"
              value={String(monthlyYear)}
              onChange={(e) => setMonthlyYear(Number(e.target.value))}
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={String(y)}>{y + 543}</option>
              ))}
            </Select>
          </div>
        </div>

        {monthly.isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} interval={1} />
                  <YAxis allowDecimals={false} tickFormatter={formatCompactNumber} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} label={{ value: 'ยอดวิว (Views)', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(label) => `วันที่ ${label}`}
                    formatter={(value) => [formatCompactNumber(value as number), 'ยอดวิว']}
                  />
                  <Line type="monotone" dataKey="views" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">
              ยอดวิวรวมรายเดือน : <span className="text-primary">{formatCompactNumber(monthly.data?.total ?? 0)}</span>
            </p>
          </>
        )}
      </div>

      {/* กราฟยอดวิวรายเดือน (เลือกปี) */}
      <div className="rounded-[15px] border border-border p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-foreground">รายงานยอดวิวรายปี</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">ข้อมูลประจำปี :</span>
            <Select
              className="h-8 w-20 text-xs"
              value={String(yearlyYear)}
              onChange={(e) => setYearlyYear(Number(e.target.value))}
            >
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={String(y)}>{y + 543}</option>
              ))}
            </Select>
          </div>
        </div>

        {yearly.isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={yearlyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis allowDecimals={false} tickFormatter={formatCompactNumber} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} label={{ value: 'ยอดวิว (Views)', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(value) => [formatCompactNumber(value as number), 'ยอดวิว']}
                  />
                  <Line type="monotone" dataKey="views" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">
              ยอดวิวรวมรายปี : <span className="text-primary">{formatCompactNumber(yearly.data?.total ?? 0)}</span>
            </p>
          </>
        )}
      </div>

      {/* ตาราง 10 อันดับตอนยอดวิวสูงสุด */}
      <div className="rounded-[15px] border border-border p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <ListOrdered className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">10 อันดับตอนที่มียอดวิวสูงสุด</h3>
        </div>

        {topEpisodes.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : !topEpisodes.data || topEpisodes.data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลยอดวิว</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="w-16 py-2 font-medium">อันดับที่</th>
                  <th className="py-2 font-medium">ชื่อตอน</th>
                  <th className="w-24 py-2 text-right font-medium">ยอดวิว</th>
                </tr>
              </thead>
              <tbody>
                {topEpisodes.data.map((ep, i) => (
                  <tr key={ep.ep_id} className="border-b border-border last:border-0">
                    <td className="py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="py-2.5 text-foreground">{formatEpisodeTitle(ep.ep_no, ep.episode_label, ep.ep_name)}</td>
                    <td className="py-2.5 text-right font-medium text-foreground" title={String(ep.views)}>{formatCompactNumber(ep.views)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
