'use client'

/**
 * components/analytics/daily-line-chart.tsx — กราฟเส้นรายวันใช้ร่วมกันทั้งหน้า Analytic (2026-08-17)
 * สไตล์เดียวกับ work-analytics-tab.tsx (Recharts + CSS var ของธีม) แค่แยกเป็น component ใช้ซ้ำ
 * เพราะหน้านี้มีกราฟหลายเส้น (สมัคร/login/รายได้/ยอดขาย/รายงาน/ระงับ ฯลฯ)
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCompactNumber } from '@/lib/utils'

export function DailyLineChart({
  data,
  label,
  color,
  valueFormatter,
}: {
  data: { date: string; value: number }[]
  label: string
  color: string
  valueFormatter?: (v: number) => string
}) {
  const fmt = valueFormatter ?? formatCompactNumber
  const chartData = data.map((d) => ({ label: d.date.slice(5), value: d.value })) // ตัดปีทิ้ง เหลือ MM-DD

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tickFormatter={(v) => fmt(v as number)} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} width={44} />
          <Tooltip
            contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
            formatter={(value) => [fmt(value as number), label]}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
