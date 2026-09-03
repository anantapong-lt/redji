'use client'

/**
 * app/(writer)/writer/overview/page.tsx — "แดชบอร์ด" (2026-08-05, แก้รอบ 3 ตาม feedback ละเอียด)
 *
 * ประวัติ: v1 ทำตาม readrealm.co (กราฟรายวันอย่างเดียว) → v2 rename เป็น "แดชบอร์ด" ตาม pdf
 * "ReadToon Creator" (เพิ่มโหมดรายวัน/เดือน/ปี, แยกการ์ด "ข้อมูลยอดขาย") → v3 (รอบนี้) แก้ตาม
 * feedback ทีละจุด:
 *   - กราฟเดิมทำเป็นแท่ง (Bar) ผิด — ของจริงเป็นเส้น+พื้นที่ใต้กราฟ (Area) แก้เป็น AreaChart
 *   - โหมดกราฟเดิม "รายวัน/รายเดือน/รายปี" ไม่ตรงที่ user ต้องการ เปลี่ยนเป็น "วัน/เดือน/ปี/ตลอด":
 *     วัน = 24 ชม.ล่าสุดแบบ rolling ปรับย้อนไม่ได้, เดือน = วันที่ 1-31 ของเดือนที่เลือก (ปีล็อกปีนี้
 *     เท่านั้น ปรับย้อนปีไม่ได้), ปี = เดือน 1-12 ของปีที่เลือก (ปรับปีได้), ตลอด = ทุกปีที่มีข้อมูลจริง
 *   - ปุ่มเลือกโหมดเดิมอยู่ฝั่งขวาสุดของแถว พอ picker ข้างๆ (เดือน/ปี) โผล่/หายทำให้ทั้งกลุ่มขยับ
 *     "เด้งไปมา" (เพราะ container เดิม justify-between ดันกลุ่มทั้งก้อนชิดขวา grow/shrink เท่าไหร่
 *     ก็ขยับซ้าย-ขวาตาม) แก้โดยแยกหัวข้อกับแถบควบคุมคนละบรรทัด แล้ววางปุ่มโหมดเป็นตัวแรกสุด
 *     (flex-start ไม่มี justify-between) ปุ่มเลยอยู่ตำแหน่งเดิมเป๊ะเสมอไม่ว่า picker ข้างๆจะโผล่ไหม
 *   - เพิ่ม "ประวัติรายได้ (ขาย)" ตาม pdf ที่มีแต่ไม่เคยใส่ (ตัด "ประวัติรายได้ (คอมมิชชั่น)" ออก
 *     เหมือนเดิม ไม่มีฟีเจอร์คอมมิชชั่น)
 *   - Stat การ์ดซ้ำ: "ยอดขาย" เดิมอยู่ทั้ง 2 การ์ด (ภาพรวมนิยาย หน่วยนับเรื่อง + ยอดขาย หน่วยเงิน) —
 *     ตัดออกจากภาพรวมนิยาย เหลือแค่ในการ์ดยอดขาย ("ตอนฟรี" ย้ายไปภาพรวมนิยายแทน) และนับใหม่ทุกเดือน
 *     (ไม่สะสมตลอดกาลแล้ว) ยอดเงินคงเหลือไม่รีเซ็ต (เงินถอนได้จริง) ตัด "จำนวนตอนขาย" ออก (ซ้ำ
 *     ความหมายกับจำนวนการขาย)
 *
 * v4 (รอบล่าสุด) แก้ตาม feedback อีกรอบ:
 *   - หน่วยเงิน: user แก้ความเข้าใจผิดของผม — "เหรียญ" ใช้แค่กับ "ยอดขาย" (ยอดเต็มไม่หัก %,
 *     ไม่ต้องมีทศนิยม) เท่านั้น ส่วน "รายได้ทั้งหมด" (หลังหัก %) กับ "ยอดเงินคงเหลือ" ต้องเป็น
 *     "บาท" (฿) มีทศนิยม 2 ตำแหน่งเหมือนเดิม — แก้กลับให้ตรง 2 หน่วยนี้ ส่วนที่อื่นที่นับ "ยอดขาย"
 *     เหมือนกัน (กราฟ/เรื่องขายดี/ประวัติการขายรายทรานแซกชัน) คงหน่วยเหรียญไว้ตามเดิม
 *   - "เรื่องขายดี": จากเดิมเลือกช่วงปฏิทิน (week/month/year) → เปลี่ยนเป็น rolling window ธรรมดา
 *     "7 วันที่ผ่านมา"/"30 วันที่ผ่านมา" (ตัด "ปี" ออก) นับยอดรวมแข่งกันเองแบบ leaderboard
 *   - เปลี่ยนหน้าตาจากลิสต์ธรรมดาเป็นกราฟแท่งแนวนอน (แต่ละแถวคือ 1 เรื่อง เรียงต่อกันแนวตั้ง) —
 *     รูปปกเล็กๆ ชิดซ้าย แท่งชี้ขวาตามสัดส่วนยอดขาย, hover เห็นชื่อเต็ม, กดแล้ว redirect ไปหน้าแก้ไข
 *     ผลงานเรื่องนั้นใน /writer/works/[uuid] — ใช้ recharts BarChart layout="vertical" + custom
 *     tick component render รูปปกเป็น SVG <image> แทน text tick ปกติ
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen, Rows3, Eye, Heart, Star, MessageCircle, Gift,
  Percent, Wallet, Receipt, Trophy, History, Search,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { api } from '@/lib/api'
import { formatCount, formatRelativeTime, cn } from '@/lib/utils'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface ApiOverviewStats {
  work_count: number
  episode_count: number
  view_count: number
  like_count: number
  bookmark_count: number
  comment_count: number
  free_episode_count: number
  sales: number
  revenue_share_percent: number
  sales_this_month: number
  net_revenue_this_month: number
  sale_count_this_month: number
  available_balance: number
}

interface ApiSalesHourly {
  hourly: { label: string; sales: number }[]
  total: number
}

interface ApiSalesMonthly {
  daily: { day: number; sales: number }[]
  month_total: number
}

interface ApiSalesYearly {
  monthly: { month: number; sales: number }[]
  year_total: number
}

interface ApiSalesByYear {
  yearly: { year: number; sales: number }[]
}

interface ApiTopSellingWork {
  uuid: string
  title: string
  cover_image: string | null
  total_sales: number
  sale_count: number
}

interface ApiSalesHistoryRow {
  id: string
  created_at: string
  ep_no: number
  price: number
  work_title: string
  buyer: { uuid: string; u_name: string; display_name: string }
}

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i)

const CHART_MODES = [
  { key: 'hour', label: 'วัน' },
  { key: 'month', label: 'เดือน' },
  { key: 'year', label: 'ปี' },
  { key: 'all', label: 'ตลอด' },
] as const
type ChartMode = (typeof CHART_MODES)[number]['key']

const SELLING_PERIODS = [
  { key: '7d', label: '7 วันที่ผ่านมา' },
  { key: '30d', label: '30 วันที่ผ่านมา' },
] as const
type SellingPeriod = (typeof SELLING_PERIODS)[number]['key']

/** ความสูงกราฟแท่งแนวนอน "เรื่องขายดี" ต่อ 1 แถว (px) — ต้องพอให้รูปปกเล็กๆ ไม่บี้ */
const TOP_SELLING_ROW_HEIGHT = 46

const HISTORY_PAGE_SIZE = 10

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

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

// ---- "เรื่องขายดี" — custom Y-axis tick ที่ render รูปปกแทน text (2026-08-05) ----
// recharts ไม่มี prop สำเร็จรูปให้ใส่รูปที่ tick ต้องเขียน tick component เองแล้ว render เป็น
// SVG <image> ตรงๆ (chart วาดบน <svg> ทั้งก้อน ใช้ <img> HTML ธรรมดาไม่ได้) — มี <title> ซ้อนไว้ด้วย
// ให้ hover เห็นชื่อเรื่องได้แม้เมาส์จะอยู่ตรงรูปปกพอดี (ไม่ได้อยู่บนแท่ง ซึ่ง Tooltip หลักคุมไม่ถึง)
function CoverTick(props: {
  x?: number
  y?: number
  payload?: { value: string }
  works: ApiTopSellingWork[]
  router: ReturnType<typeof useRouter>
}) {
  const { x, y, payload, works, router } = props
  if (x === undefined || y === undefined || !payload) return null
  const work = works.find((w) => w.uuid === payload.value)
  if (!work) return null

  const w = 26
  const h = 34
  return (
    <g
      transform={`translate(${x - w - 8}, ${y - h / 2})`}
      className="cursor-pointer"
      onClick={() => router.push(`/writer/works/${work.uuid}`)}
    >
      <title>{work.title}</title>
      {work.cover_image ? (
        <image href={work.cover_image} width={w} height={h} preserveAspectRatio="xMidYMid slice" />
      ) : (
        <rect width={w} height={h} fill="var(--muted)" rx={3} />
      )}
    </g>
  )
}

function TopSellingTooltip({ active, payload }: { active?: boolean; payload?: { payload: ApiTopSellingWork }[] }) {
  if (!active || !payload || !payload.length) return null
  const work = payload[0].payload
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-sm">
      <p className="max-w-48 truncate font-medium text-foreground">{work.title}</p>
      <p className="text-muted-foreground">{formatCoinsWhole(work.total_sales)} · {work.sale_count} การขาย</p>
    </div>
  )
}

// 2026-08-05 แก้ตาม feedback: "เหรียญ" ใช้แค่กับ "ยอดขาย" (ยอดเต็มก่อนหัก % — ไม่ต้องมีทศนิยม)
// ส่วน "รายได้ทั้งหมด" (หลังหัก %) กับ "ยอดเงินคงเหลือ" ต้องเป็น "บาท" ทศนิยม 2 ตำแหน่งเหมือนเดิม

/** ยอดขาย (เต็ม ไม่หัก) — จำนวนเต็ม ไม่มีทศนิยม + หน่วยเหรียญ ใช้กับตัวเลขก้อนใหญ่ (การ์ด/กราฟ/เรื่องขายดี) */
function formatCoinsWhole(n: number): string {
  return `${Math.round(n).toLocaleString()} เหรียญ`
}

/** ยอดขายรายทรานแซกชันเดี่ยวๆ (ประวัติการขาย) — ต้องคงทศนิยมไว้ เผื่อราคาตอนเป็นเศษเหรียญ (เช่น 0.04) */
function formatCoinsPrecise(n: number): string {
  return `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} เหรียญ`
}

/** รายได้หลังหัก %/ยอดเงินคงเหลือ — เงินจริงที่ถอนได้ ต้องเป็นหน่วยบาท มีทศนิยมเสมอ */
function formatBaht(n: number): string {
  return `฿${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function WriterOverviewPage() {
  const now = new Date()
  const [chartMode, setChartMode] = useState<ChartMode>('hour')
  const [monthModeMonth, setMonthModeMonth] = useState(now.getMonth() + 1)
  const [yearModeYear, setYearModeYear] = useState(now.getFullYear())
  const [sellingPeriod, setSellingPeriod] = useState<SellingPeriod>('7d')
  const router = useRouter()
  const [historySearchInput, setHistorySearchInput] = useState('')
  const [historySearch, setHistorySearch] = useState('')
  const [historyPage, setHistoryPage] = useState(1)

  const stats = useQuery({
    queryKey: ['writer', 'overview', 'stats'],
    queryFn: () => api.get<{ data: ApiOverviewStats }>('/writer/overview/stats').then((res) => res.data),
  })

  const hourlySales = useQuery({
    queryKey: ['writer', 'overview', 'sales-hourly'],
    queryFn: () => api.get<{ data: ApiSalesHourly }>('/writer/overview/sales-hourly').then((res) => res.data),
    enabled: chartMode === 'hour',
    // user บอกไว้ว่า "ถ้ากิน Performance ให้เป็นรีทุก 4 ชม." (เงื่อนไข ไม่ใช่บังคับ) — query
    // เบามาก (group by ธรรมดาบน ep_shop scope แค่ 24 ชม.) เลยไม่ auto-poll เลยตามนี้ก่อน เหมือน
    // query อื่นทุกตัวในหน้านี้ (โหลดใหม่ตอนสลับโหมด ไม่ตั้งเวลาโพลอัตโนมัติ) ถ้าจริงๆ อยากได้ความ
    // สด real-time มากกว่านี้ค่อยเพิ่ม refetchInterval ทีหลังได้
  })

  const monthlySales = useQuery({
    queryKey: ['writer', 'overview', 'sales-monthly', CURRENT_YEAR, monthModeMonth],
    queryFn: () =>
      api
        .get<{ data: ApiSalesMonthly }>(`/writer/overview/sales-monthly?year=${CURRENT_YEAR}&month=${monthModeMonth}`)
        .then((res) => res.data),
    enabled: chartMode === 'month',
  })

  const yearlySales = useQuery({
    queryKey: ['writer', 'overview', 'sales-yearly', yearModeYear],
    queryFn: () =>
      api.get<{ data: ApiSalesYearly }>(`/writer/overview/sales-yearly?year=${yearModeYear}`).then((res) => res.data),
    enabled: chartMode === 'year',
  })

  const allSales = useQuery({
    queryKey: ['writer', 'overview', 'sales-by-year'],
    queryFn: () => api.get<{ data: ApiSalesByYear }>('/writer/overview/sales-by-year').then((res) => res.data),
    enabled: chartMode === 'all',
  })

  const topSelling = useQuery({
    queryKey: ['writer', 'overview', 'top-selling', sellingPeriod],
    queryFn: () =>
      api.get<{ data: ApiTopSellingWork[] }>(`/writer/overview/top-selling?period=${sellingPeriod}`).then((res) => res.data),
  })

  const history = useQuery({
    queryKey: ['writer', 'overview', 'sales-history', historyPage, historySearch],
    queryFn: () =>
      api.get<{ data: ApiSalesHistoryRow[]; pagination: { page: number; pages: number; total: number } }>(
        `/writer/overview/sales-history?page=${historyPage}&limit=${HISTORY_PAGE_SIZE}${historySearch ? `&search=${encodeURIComponent(historySearch)}` : ''}`,
      ),
  })

  const chartIsLoading =
    (chartMode === 'hour' && hourlySales.isLoading) ||
    (chartMode === 'month' && monthlySales.isLoading) ||
    (chartMode === 'year' && yearlySales.isLoading) ||
    (chartMode === 'all' && allSales.isLoading)

  const chartData =
    chartMode === 'hour'
      ? (hourlySales.data?.hourly ?? []).map((h) => ({ label: h.label, sales: h.sales }))
      : chartMode === 'month'
        ? (monthlySales.data?.daily ?? []).map((d) => ({ label: String(d.day), sales: d.sales }))
        : chartMode === 'year'
          ? (yearlySales.data?.monthly ?? []).map((m) => ({ label: THAI_MONTHS_FULL[m.month - 1].slice(0, 3), sales: m.sales }))
          : (allSales.data?.yearly ?? []).map((y) => ({ label: String(y.year + 543), sales: y.sales }))

  const periodTotal =
    chartMode === 'hour'
      ? (hourlySales.data?.total ?? 0)
      : chartMode === 'month'
        ? (monthlySales.data?.month_total ?? 0)
        : chartMode === 'year'
          ? (yearlySales.data?.year_total ?? 0)
          : (allSales.data?.yearly ?? []).reduce((sum, y) => sum + y.sales, 0)

  const periodTotalLabel =
    chartMode === 'hour' ? 'รวมยอดขาย 24 ชม.ล่าสุด'
      : chartMode === 'month' ? 'รวมยอดขายเฉพาะเดือนนี้'
        : chartMode === 'year' ? 'รวมยอดขายเฉพาะปีนี้'
          : 'รวมยอดขายทุกปี'

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-foreground">แดชบอร์ด</h1>

      <div className="mb-8">
        <h2 className="mb-3 text-sm font-bold text-foreground">ข้อมูลภาพรวมนิยาย</h2>
        {stats.isLoading || !stats.data ? (
          <p className="py-4 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <StatCard icon={BookOpen} label="จำนวนเรื่อง" value={formatCount(stats.data.work_count)} iconClassName="bg-primary/15 text-primary" />
            <StatCard icon={Rows3} label="จำนวนตอน" value={formatCount(stats.data.episode_count)} iconClassName="bg-teal-500/15 text-teal-500" />
            <StatCard icon={Eye} label="จำนวนยอดวิว" value={formatCount(stats.data.view_count)} iconClassName="bg-amber-500/15 text-amber-500" />
            <StatCard icon={Heart} label="จำนวนยอดคนชื่นชอบ" value={formatCount(stats.data.like_count)} iconClassName="bg-pink-500/15 text-pink-500" />
            <StatCard icon={Star} label="ผู้ติดตามเรื่อง" value={formatCount(stats.data.bookmark_count)} iconClassName="bg-violet-500/15 text-violet-500" />
            <StatCard icon={MessageCircle} label="จำนวนยอด Comments" value={formatCount(stats.data.comment_count)} iconClassName="bg-sky-500/15 text-sky-500" />
            <StatCard icon={Gift} label="จำนวนตอนฟรี" value={formatCount(stats.data.free_episode_count)} iconClassName="bg-emerald-500/15 text-emerald-500" />
          </div>
        )}
      </div>

      <div className="mb-8">
        <h2 className="mb-3 text-sm font-bold text-foreground">ข้อมูลยอดขาย</h2>
        {stats.isLoading || !stats.data ? (
          <p className="py-4 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard icon={Percent} label="ส่วนแบ่งรายได้" value={`${stats.data.revenue_share_percent}%`} iconClassName="bg-primary/15 text-primary" />
            <StatCard icon={Wallet} label="ยอดขาย (เดือนนี้)" value={formatCoinsWhole(stats.data.sales_this_month)} iconClassName="bg-amber-600/15 text-amber-600" />
            <StatCard icon={Wallet} label="รายได้ทั้งหมด (เดือนนี้)" value={formatBaht(stats.data.net_revenue_this_month)} iconClassName="bg-teal-500/15 text-teal-500" />
            <StatCard icon={Wallet} label="ยอดเงินคงเหลือ" value={formatBaht(stats.data.available_balance)} iconClassName="bg-sky-500/15 text-sky-500" />
            <StatCard icon={Receipt} label="จำนวนการขาย (เดือนนี้)" value={formatCount(stats.data.sale_count_this_month)} iconClassName="bg-violet-500/15 text-violet-500" />
          </div>
        )}
      </div>

      <div className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
            <Trophy className="size-4 text-amber-500" />
            เรื่องขายดี
          </h2>
          <div className="flex items-center gap-1.5">
            {SELLING_PERIODS.map((p) => (
              <Pill key={p.key} active={sellingPeriod === p.key} onClick={() => setSellingPeriod(p.key)}>
                {p.label}
              </Pill>
            ))}
          </div>
        </div>

        <div className="rounded-[15px] border border-border p-4">
          {topSelling.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
          ) : !topSelling.data || topSelling.data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มียอดขายในช่วงนี้</p>
          ) : (
            // กราฟแท่งแนวนอน (แต่ละแถว = 1 เรื่อง เรียงต่อกันแนวตั้ง) — รูปปกชิดซ้าย แท่งชี้ขวา
            // ตามสัดส่วนยอดขาย hover เห็นชื่อเต็ม กดแล้ว redirect ไปหน้าแก้ไขผลงานเรื่องนั้น
            // (ตาม feedback 2026-08-05 — ไม่ใช่ลิสต์ธรรมดาแบบเดิมแล้ว)
            <div style={{ height: topSelling.data.length * TOP_SELLING_ROW_HEIGHT }} className="w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSelling.data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="uuid"
                    width={44}
                    axisLine={false}
                    tickLine={false}
                    tick={<CoverTick works={topSelling.data} router={router} />}
                  />
                  <Tooltip content={<TopSellingTooltip />} cursor={{ fill: 'var(--muted)' }} />
                  <Bar
                    dataKey="total_sales"
                    fill="var(--primary)"
                    radius={[0, 6, 6, 0]}
                    cursor="pointer"
                    onClick={(data) => router.push(`/writer/works/${(data as unknown as ApiTopSellingWork).uuid}`)}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-3 text-sm font-bold text-foreground">ข้อมูลรายได้</h2>
        <div className="rounded-[15px] border border-border p-4">
          <h3 className="mb-3 text-sm font-bold text-foreground">รายได้ (ขาย)</h3>

          {/* ปุ่มโหมดอยู่ซ้ายสุดเสมอ (flex-start ไม่มี justify-between) — picker โผล่/หายข้างๆ ไม่ทำให้
              ปุ่มโหมดขยับตำแหน่งอีกต่อไป (2026-08-05 แก้ตาม feedback "เด้งไปมาไม่หยุด") */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              {CHART_MODES.map((m) => (
                <Pill key={m.key} active={chartMode === m.key} onClick={() => setChartMode(m.key)}>
                  {m.label}
                </Pill>
              ))}
            </div>

            {chartMode === 'month' && (
              <Select value={String(monthModeMonth)} onValueChange={(v) => setMonthModeMonth(Number(v))}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THAI_MONTHS_FULL.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {chartMode === 'year' && (
              <Select value={String(yearModeYear)} onValueChange={(v) => setYearModeYear(Number(v))}>
                <SelectTrigger className="h-8 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y + 543}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {chartMode === 'hour' && (
              <span className="text-xs text-muted-foreground">รายงานล่าสุด ณ ตอนนี้ — ย้อนหลังไม่ได้</span>
            )}
          </div>

          {chartIsLoading ? (
            <p className="py-16 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
          ) : (
            <>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesAreaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                      interval={chartMode === 'month' ? 1 : 0}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} label={{ value: 'ยอดขาย (เหรียญ)', angle: -90, position: 'insideLeft', fontSize: 11, fill: 'var(--muted-foreground)' }} />
                    <Tooltip
                      contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      labelFormatter={(label) => (chartMode === 'month' ? `วันที่ ${label}` : chartMode === 'hour' ? `เวลา ${label}` : label)}
                      formatter={(value) => [value as number, 'ยอดขาย']}
                    />
                    <Area type="monotone" dataKey="sales" stroke="var(--primary)" strokeWidth={2} fill="url(#salesAreaFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm font-medium text-foreground">
                <span>
                  {periodTotalLabel} : <span className="text-primary">{formatCoinsWhole(periodTotal)}</span>
                </span>
                <span>
                  รวมยอดขายสะสมทั้งหมดของบัญชี : <span className="text-primary">{formatCoinsWhole(stats.data?.sales ?? 0)}</span>
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-foreground">
          <History className="size-4 text-muted-foreground" />
          ประวัติรายได้ (ขาย)
        </h2>
        <div className="rounded-[15px] border border-border p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setHistoryPage(1)
              setHistorySearch(historySearchInput.trim())
            }}
            className="mb-4 flex flex-wrap gap-2"
          >
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={historySearchInput}
                onChange={(e) => setHistorySearchInput(e.target.value)}
                placeholder="ค้นหาด้วย username, ชื่อที่แสดง..."
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="outline">ค้นหา</Button>
          </form>

          {history.isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
          ) : !history.data || history.data.data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีประวัติการขาย</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="py-2 font-medium">วันที่</th>
                      <th className="py-2 font-medium">ผู้ใช้</th>
                      <th className="py-2 font-medium">เนื้อหา</th>
                      <th className="py-2 text-center font-medium">ตอน</th>
                      <th className="py-2 text-right font-medium">จำนวนเงิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.data.data.map((row) => (
                      <tr key={row.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 whitespace-nowrap text-muted-foreground">{formatRelativeTime(row.created_at)}</td>
                        <td className="py-2.5">
                          <div className="font-medium text-foreground">{row.buyer.display_name}</div>
                          <div className="text-xs text-muted-foreground">@{row.buyer.u_name}</div>
                        </td>
                        <td className="py-2.5 text-foreground">{row.work_title}</td>
                        <td className="py-2.5 text-center text-foreground">{row.ep_no}</td>
                        <td className="py-2.5 text-right font-medium text-primary">{formatCoinsPrecise(row.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {history.data.pagination.pages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-3 text-sm text-muted-foreground">
                  <Button
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={historyPage <= 1}
                    onClick={() => setHistoryPage((p) => p - 1)}
                  >
                    ก่อนหน้า
                  </Button>
                  <span>
                    หน้า {history.data.pagination.page} / {history.data.pagination.pages} (ทั้งหมด {history.data.pagination.total} รายการ)
                  </span>
                  <Button
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={historyPage >= history.data.pagination.pages}
                    onClick={() => setHistoryPage((p) => p + 1)}
                  >
                    ถัดไป
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
