'use client'

/**
 * components/writer/work-analytics-tab.tsx — แท็บ "สถิติเจาะลึก" ในหน้าแก้ไขผลงาน (2026-08-05, ใหม่)
 *
 * ทำตาม pdf อ้างอิงที่ user ส่งมา (readrealm.co ระบบจัดการนักเขียน): การ์ดสรุป 4 ตัว + กราฟเส้นยอดวิว
 * รายวัน(เลือกเดือน/ปีได้) + กราฟเส้นยอดวิวรายเดือน(เลือกปีได้) + ตาราง 10 อันดับตอนยอดวิวสูงสุด
 * นี่คือกราฟ "เจาะลึกเรื่องเดียว" ตามที่ user บอก ส่วนกราฟภาพรวม (dashboard ใหญ่) ทำทีหลัง
 *
 * ⚠️ ข้อจำกัดข้อมูล: กราฟ 2 อันนับจาก work_ep_views ซึ่งบันทึกเฉพาะตอนที่ user login อ่าน (guest
 * อ่านไม่ถูกนับใน log นี้ — ดูคอมเมนต์ที่ getWorkViewsMonthly ฝั่ง backend) ยอดในกราฟเลยอาจน้อยกว่า
 * ยอดวิวรวมจริงที่การ์ด "ยอดวิว" ด้านบนโชว์ (นับรวม guest ด้วย) — flag ไว้ใน KNOWN_ISSUES.md แล้ว
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Eye, Heart, Star, MessageCircle, ListOrdered } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { api } from '@/lib/api'
import { formatCount } from '@/lib/utils'
import { formatEpisodeTitle } from '@/lib/episode-format'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

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
// ตัวเลือกปีย้อนหลัง 5 ปี (ค.ศ. ใช้ยิง API ตรงๆ, แสดงผลเป็น พ.ศ. ในตัวเลือกตาม convention เดิมของเว็บ)
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
    queryKey: ['writer', 'work', workUuid, 'stats'],
    queryFn: () => api.get<{ data: ApiWorkStats }>(`/writer/works/${workUuid}/stats`).then((res) => res.data),
  })

  const monthly = useQuery({
    queryKey: ['writer', 'work', workUuid, 'stats', 'monthly', monthlyYear, monthlyMonth],
    queryFn: () =>
      api
        .get<{ data: ApiMonthlyViews }>(`/writer/works/${workUuid}/stats/monthly?year=${monthlyYear}&month=${monthlyMonth}`)
        .then((res) => res.data),
  })

  const yearly = useQuery({
    queryKey: ['writer', 'work', workUuid, 'stats', 'yearly', yearlyYear],
    queryFn: () =>
      api.get<{ data: ApiYearlyViews }>(`/writer/works/${workUuid}/stats/yearly?year=${yearlyYear}`).then((res) => res.data),
  })

  const topEpisodes = useQuery({
    queryKey: ['writer', 'work', workUuid, 'stats', 'top-episodes'],
    queryFn: () =>
      api.get<{ data: ApiTopEpisode[] }>(`/writer/works/${workUuid}/stats/top-episodes`).then((res) => res.data),
  })

  const monthlyChartData = (monthly.data?.daily ?? []).map((d) => ({ label: String(d.day), views: d.views }))
  const yearlyChartData = (yearly.data?.monthly ?? []).map((m) => ({ label: THAI_MONTHS_FULL[m.month - 1].slice(0, 3), views: m.views }))

  return (
    <div className="flex flex-col gap-6">
      {stats.isLoading || !stats.data ? (
        <p className="py-4 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={Eye} label="จำนวนยอดวิว" value={formatCount(stats.data.view_count)} iconClassName="bg-amber-500/15 text-amber-500" />
          <StatCard icon={Heart} label="จำนวนคนชื่นชอบ" value={formatCount(stats.data.like_count)} iconClassName="bg-pink-500/15 text-pink-500" />
          <StatCard icon={Star} label="จำนวนผู้ติดตาม" value={formatCount(stats.data.bookmark_count)} iconClassName="bg-primary/15 text-primary" />
          <StatCard icon={MessageCircle} label="จำนวน Comment" value={formatCount(stats.data.comment_count)} iconClassName="bg-sky-500/15 text-sky-500" />
        </div>
      )}

      {/* กราฟยอดวิวรายวัน (เลือกเดือน/ปี) */}
      <div className="rounded-[15px] border border-border p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-foreground">รายงานยอดวิวรายเดือน</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">ข้อมูลประจำเดือน :</span>
            <Select value={String(monthlyMonth)} onValueChange={(v) => setMonthlyMonth(Number(v))}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THAI_MONTHS_FULL.map((m, i) => (
                  <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">ปี :</span>
            <Select value={String(monthlyYear)} onValueChange={(v) => setMonthlyYear(Number(v))}>
              <SelectTrigger className="h-8 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {monthly.isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="workMonthlyViewsAreaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} interval={1} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} label={{ value: 'ยอดวิว (Views)', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(label) => `วันที่ ${label}`}
                    formatter={(value) => [value as number, 'ยอดวิว']}
                  />
                  <Area type="monotone" dataKey="views" stroke="var(--primary)" strokeWidth={2} fill="url(#workMonthlyViewsAreaFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">
              ยอดวิวรวมรายเดือน : <span className="text-primary">{monthly.data?.total ?? 0}</span>
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
            <Select value={String(yearlyYear)} onValueChange={(v) => setYearlyYear(Number(v))}>
              <SelectTrigger className="h-8 w-20 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {yearly.isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : (
          <>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={yearlyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="workYearlyViewsAreaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} label={{ value: 'ยอดวิว (Views)', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--muted-foreground)' }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(value) => [value as number, 'ยอดวิว']}
                  />
                  <Area type="monotone" dataKey="views" stroke="var(--primary)" strokeWidth={2} fill="url(#workYearlyViewsAreaFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-sm font-medium text-foreground">
              ยอดวิวรวมรายปี : <span className="text-primary">{yearly.data?.total ?? 0}</span>
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
                    <td className="py-2.5 text-right font-medium text-foreground">{ep.views}</td>
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
