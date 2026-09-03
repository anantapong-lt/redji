'use client'

/**
 * app/(dashboard)/analytics/page.tsx — Analytic (2026-08-17, ต่อจริงตามที่ user เลือก)
 *
 * เดิมเป็นโครงว่างรอกราฟ — ตอนนี้มี 3 หมวดตามที่ user เลือก (ภาพรวมเว็บ+นักอ่าน / การเงิน /
 * การควบคุมเนื้อหา) เว้นหมวด "นักเขียน/ผลงาน" ไว้ก่อน (ยังไม่ได้เลือก ทำรอบหน้าได้ถ้าต้องการ)
 *
 * การเข้าถึงจริงคุมที่ backend ทั้งหมดผ่าน permission matrix (system.analytics.view /
 * system.analytics_finance.view — ปรับได้ที่หน้าตั้งค่า) — หน้านี้เช็ค level<8 แค่กันโครงเฉยๆ
 * (defense-in-depth เหมือนหน้าอื่นในแอปนี้ ไม่ใช่ security gate จริง)
 *
 * 2026-08-18 มติแก้: user ขอให้ level 8 เข้าดูได้ด้วย (เดิม level >= 9 เท่านั้น — ดู migration 055
 * ที่เปิด system.analytics.view ให้ level 8 แล้ว) แต่ทั้ง level 8 และ 9 ต้องไม่เห็นหมวดการเงิน —
 * หมวดการเงิน **ไม่เช็ค level ในนี้เลย** แค่ยิง request ไปเฉยๆ แล้วถ้า backend ตอบ error (ไม่มี
 * สิทธิ์) ก็ไม่โชว์หมวดนี้ — ทำแบบนี้เพื่อให้ตรงกับ permission matrix จริงเสมอ (level 10 default
 * แต่ future อาจถูกเปิดให้ level 8/9 เห็นได้จากหน้าตั้งค่า โดยไม่ต้องแก้โค้ดหน้านี้เลย)
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Users, BookOpen, UserPlus, Activity, Coins, Wallet, Flag, ShieldAlert } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { DailyLineChart } from '@/components/analytics/daily-line-chart'
import { api } from '@/lib/api'
import { formatCompactNumber } from '@/lib/utils'
import { useAdminUser } from '@/store/auth.store'

const DAYS_OPTIONS = [7, 30, 90] as const

function formatBaht(v: number): string {
  return `฿${formatCompactNumber(v)}`
}

interface OverviewData {
  total_users: number
  readers: number
  writers: number
  house_writers: number
  staff: number
  published_works: number
  draft_works: number
  signups_today: number
  signups_week: number
  signups_month: number
  active_today: number
  active_month: number
  revenue_today: number
  revenue_month: number
}

interface ReaderData {
  signup_series: { date: string; value: number }[]
  dau_series: { date: string; value: number }[]
  top_spenders: { uuid: string; display_name: string; u_name: string; coins_spent: number }[]
}

interface FinanceData {
  topup_series: { date: string; value: number }[]
  sales_series: { date: string; value: number }[]
  platform_net_series: { date: string; value: number }[]
  withdrawals_pending: { total: number; count: number }
  withdrawals_approved_this_month: number
  package_performance: { package_id: string | null; coin_amount: number | null; bonus: number | null; price: string | null; purchase_count: number }[]
}

interface ModerationData {
  reports_filed_series: { date: string; value: number }[]
  reports_resolved_series: { date: string; value: number }[]
  penalty_series: { date: string; value: number }[]
  pending_reports: number
}

function StatCard({ icon: Icon, label, value, sub, iconClassName }: { icon: typeof Users; label: string; value: string; sub?: string; iconClassName: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[15px] border border-dashed border-border p-4">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconClassName}`}>
        <Icon className="size-5" />
      </div>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[15px] border border-border p-4">
      <h3 className="mb-4 text-sm font-bold text-foreground">{title}</h3>
      {children}
    </div>
  )
}

export default function AnalyticsPage() {
  const me = useAdminUser()
  const myLevel = me?.level ?? 0
  const [days, setDays] = useState<number>(30)

  const overview = useQuery({
    queryKey: ['admin', 'analytics', 'overview'],
    queryFn: () => api.get<{ data: OverviewData }>('/admin/analytics/overview').then((r) => r.data),
    enabled: myLevel >= 8,
  })
  const readers = useQuery({
    queryKey: ['admin', 'analytics', 'readers', days],
    queryFn: () => api.get<{ data: ReaderData }>(`/admin/analytics/readers?days=${days}`).then((r) => r.data),
    enabled: myLevel >= 8,
  })
  const moderation = useQuery({
    queryKey: ['admin', 'analytics', 'moderation', days],
    queryFn: () => api.get<{ data: ModerationData }>(`/admin/analytics/moderation?days=${days}`).then((r) => r.data),
    enabled: myLevel >= 8,
  })
  // หมวดการเงิน — ไม่เช็ค level เอง ปล่อยให้ backend ตัดสิน (ดู comment หัวไฟล์)
  const finance = useQuery({
    queryKey: ['admin', 'analytics', 'finance', days],
    queryFn: () => api.get<{ data: FinanceData }>(`/admin/analytics/finance?days=${days}`).then((r) => r.data),
    enabled: myLevel >= 8,
    retry: false,
  })

  if (myLevel < 8) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold text-foreground">Analytic</h1>
        <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          ต้องเป็นแอดมินขึ้นไป (level ≥ 8) ถึงจะเข้าดูแท็บนี้ได้
        </p>
      </div>
    )
  }

  const o = overview.data
  const canSeeFinance = finance.isSuccess && !finance.isError

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <BarChart3 className="size-6" />
          Analytic
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">ช่วงเวลากราฟ :</span>
          <Select className="h-9 w-28 text-sm" value={String(days)} onChange={(e) => setDays(Number(e.target.value))}>
            {DAYS_OPTIONS.map((d) => (
              <option key={d} value={String(d)}>ย้อนหลัง {d} วัน</option>
            ))}
          </Select>
        </div>
      </div>

      {/* ภาพรวมเว็บ */}
      <SectionCard title="ภาพรวมเว็บ">
        {overview.isLoading || !o ? (
          <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard icon={Users} label="ผู้ใช้ทั้งหมด" value={formatCompactNumber(o.total_users)} sub={`นักอ่าน ${o.readers} · นักเขียน ${o.writers + o.house_writers} · ทีมงาน ${o.staff}`} iconClassName="bg-sky-500/15 text-sky-500" />
            <StatCard icon={BookOpen} label="ผลงาน" value={formatCompactNumber(o.published_works)} sub={`ร่างอีก ${o.draft_works} เรื่อง`} iconClassName="bg-primary/15 text-primary" />
            <StatCard icon={UserPlus} label="สมัครใหม่วันนี้" value={formatCompactNumber(o.signups_today)} sub={`สัปดาห์นี้ ${o.signups_week} · เดือนนี้ ${o.signups_month}`} iconClassName="bg-emerald-500/15 text-emerald-500" />
            <StatCard icon={Activity} label="Active วันนี้" value={formatCompactNumber(o.active_today)} sub={`เดือนนี้ ${o.active_month}`} iconClassName="bg-amber-500/15 text-amber-500" />
            <StatCard icon={Coins} label="รายได้เติมเงินวันนี้" value={formatBaht(o.revenue_today)} sub={`เดือนนี้ ${formatBaht(o.revenue_month)}`} iconClassName="bg-fuchsia-500/15 text-fuchsia-500" />
          </div>
        )}
      </SectionCard>

      {/* การควบคุมเนื้อหา — 2026-08-18: ย้ายมาไว้บนสุด (ต่อจากภาพรวมเว็บทันที) ตามที่ user ขอ
          เพราะใช้บ่อยกว่าส่วนอื่น */}
      <h2 className="mt-8 mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
        <ShieldAlert className="size-5" />
        การควบคุมเนื้อหา
      </h2>
      {moderation.isLoading || !moderation.data ? (
        <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={Flag} label="รายงานค้างอยู่" value={formatCompactNumber(moderation.data.pending_reports)} iconClassName="bg-rose-500/15 text-rose-500" />
          </div>
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SectionCard title="รายงานเนื้อหา (แจ้ง vs ปิดเคส) รายวัน">
              <DailyLineChart data={moderation.data.reports_filed_series} label="แจ้งเข้ามา" color="#f43f5e" />
              <div className="mt-2">
                <DailyLineChart data={moderation.data.reports_resolved_series} label="ปิดเคสแล้ว" color="#10b981" />
              </div>
            </SectionCard>
            <SectionCard title="แบน/ระงับผู้ใช้รายวัน">
              <DailyLineChart data={moderation.data.penalty_series} label="แบน/ระงับ" color="#f59e0b" />
            </SectionCard>
          </div>
        </>
      )}

      {/* นักอ่าน */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <SectionCard title="สมัครสมาชิกรายวัน">
          {readers.isLoading || !readers.data ? (
            <p className="py-16 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
          ) : (
            <DailyLineChart data={readers.data.signup_series} label="สมัครใหม่" color="var(--primary)" />
          )}
        </SectionCard>
        <SectionCard title="ผู้ใช้ Active รายวัน (login)">
          {readers.isLoading || !readers.data ? (
            <p className="py-16 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
          ) : (
            <DailyLineChart data={readers.data.dau_series} label="Active" color="#0ea5e9" />
          )}
        </SectionCard>
      </div>

      <div className="mt-5">
        <SectionCard title="ใช้เหรียญเยอะสุด (10 อันดับ)">
          {readers.isLoading || !readers.data ? (
            <p className="py-8 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
          ) : readers.data.top_spenders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลในช่วงเวลานี้</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="w-16 py-2 font-medium">อันดับ</th>
                    <th className="py-2 font-medium">ผู้ใช้</th>
                    <th className="w-32 py-2 text-right font-medium">เหรียญที่ใช้</th>
                  </tr>
                </thead>
                <tbody>
                  {readers.data.top_spenders.map((s, i) => (
                    <tr key={s.uuid} className="border-b border-border last:border-0">
                      <td className="py-2.5 text-muted-foreground">{i + 1}</td>
                      <td className="py-2.5 text-foreground">
                        {s.display_name} <span className="text-xs text-muted-foreground">@{s.u_name}</span>
                      </td>
                      <td className="py-2.5 text-right font-medium text-foreground">{formatCompactNumber(s.coins_spent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* การเงิน — level 10 default, ซ่อนเงียบๆ ถ้าไม่มีสิทธิ์ */}
      {canSeeFinance && finance.data && (
        <>
          <h2 className="mt-8 mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
            <Wallet className="size-5" />
            การเงิน
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={Wallet} label="ถอนเงินรออนุมัติ" value={formatBaht(finance.data.withdrawals_pending.total)} sub={`${finance.data.withdrawals_pending.count} รายการ`} iconClassName="bg-amber-500/15 text-amber-500" />
            <StatCard icon={Wallet} label="ถอนเงินอนุมัติแล้ว (เดือนนี้)" value={formatBaht(finance.data.withdrawals_approved_this_month)} iconClassName="bg-emerald-500/15 text-emerald-500" />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
            <SectionCard title="รายได้เติมเงินรายวัน">
              <DailyLineChart data={finance.data.topup_series} label="รายได้" color="var(--primary)" valueFormatter={formatBaht} />
            </SectionCard>
            <SectionCard title="ยอดขายตอนรายวัน (ก่อนหักส่วนแบ่ง)">
              <DailyLineChart data={finance.data.sales_series} label="ยอดขาย" color="#a855f7" valueFormatter={formatBaht} />
            </SectionCard>
            <SectionCard title="กำไรเว็บสุทธิรายวัน (หลังหักส่วนแบ่งนักเขียน)">
              <DailyLineChart data={finance.data.platform_net_series} label="กำไรเว็บ" color="#10b981" valueFormatter={formatBaht} />
            </SectionCard>
          </div>

          <div className="mt-5">
            <SectionCard title={`แพ็กเกจเติมเงินขายดี (${days} วันล่าสุด)`}>
              {finance.data.package_performance.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีการเติมเงินในช่วงเวลานี้</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="py-2 font-medium">แพ็กเกจ</th>
                        <th className="w-28 py-2 text-right font-medium">ราคา</th>
                        <th className="w-28 py-2 text-right font-medium">จำนวนที่ขาย</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finance.data.package_performance.map((p) => (
                        <tr key={p.package_id ?? 'unknown'} className="border-b border-border last:border-0">
                          <td className="py-2.5 text-foreground">
                            {p.coin_amount !== null ? `${formatCompactNumber(p.coin_amount)} เหรียญ${p.bonus ? ` +${formatCompactNumber(p.bonus)} โบนัส` : ''}` : 'แพ็กเกจถูกลบไปแล้ว'}
                          </td>
                          <td className="py-2.5 text-right text-foreground">{p.price ? formatBaht(Number(p.price)) : '—'}</td>
                          <td className="py-2.5 text-right font-medium text-foreground">{p.purchase_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  )
}
