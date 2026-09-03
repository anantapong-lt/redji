// =============================================================
// Novel Platform — Admin Analytics Service (2026-08-17, ใหม่)
// วางไว้ที่: apps/api/src/modules/admin/admin-analytics.service.ts
// =============================================================
//
// หน้า Analytic (apps/admin) เดิมเป็นแค่โครงว่างรอทำ (PlaceholderPage) — ไฟล์นี้เป็น query จริงชุดแรก
// ครอบคลุม 3 หมวดตามที่ user เลือก (ภาพรวมเว็บ+นักอ่าน / การเงิน / การควบคุมเนื้อหา — เว้นหมวด
// "นักเขียน/ผลงาน" ไว้ก่อนตามที่ยังไม่ได้เลือก) หมวดการเงินแยก gate เป็นคนละ permission action
// (system.analytics_finance.view, default level 10 เท่านั้น) เพราะเป็นข้อมูลอ่อนไหวกว่า
//
// รูปแบบกราฟรายวัน = "date_trunc('day', created_at)" groupBy/orderBy ตาม pattern เดิมที่มีอยู่แล้ว
// (getUserSpendingSeries ใน admin.service.ts) เติมวันที่ไม่มีข้อมูลให้เป็น 0 เสมอ (fillDailySeries)
// กันกราฟข้ามวันเวลาที่ไม่มี transaction เลย

import { db } from '../../db'
import { sql } from 'kysely'

function startOfDay(d = new Date()): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
function startOfMonth(d = new Date()): Date {
  const x = new Date(d)
  x.setDate(1)
  x.setHours(0, 0, 0, 0)
  return x
}
function daysAgo(n: number): Date {
  const x = new Date()
  x.setDate(x.getDate() - n)
  return x
}
function dayKey(d: Date): string {
  return new Date(d).toISOString().slice(0, 10)
}

// เติมวันที่ไม่มีข้อมูลให้เป็น 0 เสมอ (ย้อนหลัง N วันจากวันนี้ รวมวันนี้ด้วย)
function fillDailySeries(rows: { day: string | Date; value: string | number | null }[], days: number): { date: string; value: number }[] {
  const map = new Map(rows.map((r) => [dayKey(new Date(r.day)), Number(r.value ?? 0)]))
  const result: { date: string; value: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(daysAgo(i))
    result.push({ date: key, value: map.get(key) ?? 0 })
  }
  return result
}

const DAY_TRUNC = sql<string>`date_trunc('day', created_at)`
const REVIEWED_DAY_TRUNC = sql<string>`date_trunc('day', reviewed_at)`
// ใช้เฉพาะ query ที่ join หลายตารางที่มีคอลัมน์ created_at ซ้ำกัน (เช่น ep_shop+works+users) —
// created_at เฉยๆ จะ ambiguous ต้อง qualify ด้วยชื่อ alias เสมอ
const EP_SHOP_DAY_TRUNC = sql<string>`date_trunc('day', s.created_at)`

// =============================================================
// 1. ภาพรวมเว็บ — การ์ดตัวเลขบนสุด
// =============================================================
export async function getSiteOverview() {
  const todayStart = startOfDay()
  const weekStart = daysAgo(7)
  const monthStart = startOfMonth()

  const [
    usersByLevel,
    workStats,
    signupsToday,
    signupsWeek,
    signupsMonth,
    activeToday,
    activeMonth,
    revenueToday,
    revenueMonth,
  ] = await Promise.all([
    db.selectFrom('users').select(['level', ({ fn }) => fn.countAll<string>().as('count')]).where('deleted_at', 'is', null).groupBy('level').execute(),
    db.selectFrom('works').select(['publish_status', ({ fn }) => fn.countAll<string>().as('count')]).where('status', '=', 'active').groupBy('publish_status').execute(),
    db.selectFrom('users').select(({ fn }) => fn.countAll<string>().as('count')).where('created_at', '>=', todayStart).where('deleted_at', 'is', null).executeTakeFirstOrThrow(),
    db.selectFrom('users').select(({ fn }) => fn.countAll<string>().as('count')).where('created_at', '>=', weekStart).where('deleted_at', 'is', null).executeTakeFirstOrThrow(),
    db.selectFrom('users').select(({ fn }) => fn.countAll<string>().as('count')).where('created_at', '>=', monthStart).where('deleted_at', 'is', null).executeTakeFirstOrThrow(),
    db.selectFrom('login_history').select(({ fn }) => fn.count<string>('user_id').distinct().as('count')).where('created_at', '>=', todayStart).where('user_id', 'is not', null).executeTakeFirstOrThrow(),
    db.selectFrom('login_history').select(({ fn }) => fn.count<string>('user_id').distinct().as('count')).where('created_at', '>=', monthStart).where('user_id', 'is not', null).executeTakeFirstOrThrow(),
    db.selectFrom('topup_transactions').select(({ fn }) => fn.sum<string | null>('amount_paid').as('total')).where('status', '=', 'completed').where('created_at', '>=', todayStart).executeTakeFirstOrThrow(),
    db.selectFrom('topup_transactions').select(({ fn }) => fn.sum<string | null>('amount_paid').as('total')).where('status', '=', 'completed').where('created_at', '>=', monthStart).executeTakeFirstOrThrow(),
  ])

  const levelCounts = new Map(usersByLevel.map((r) => [r.level, Number(r.count)]))
  const readers = levelCounts.get(1) ?? 0
  const writers = levelCounts.get(6) ?? 0
  const houseWriters = levelCounts.get(7) ?? 0
  const staff = [...levelCounts.entries()].filter(([lv]) => lv >= 8).reduce((sum, [, c]) => sum + c, 0)

  const published = workStats.find((w) => w.publish_status === 1)
  const draft = workStats.find((w) => w.publish_status === 0)

  return {
    total_users: readers + writers + houseWriters + staff,
    readers,
    writers,
    house_writers: houseWriters,
    staff,
    published_works: Number(published?.count ?? 0),
    draft_works: Number(draft?.count ?? 0),
    signups_today: Number(signupsToday.count),
    signups_week: Number(signupsWeek.count),
    signups_month: Number(signupsMonth.count),
    active_today: Number(activeToday.count),
    active_month: Number(activeMonth.count),
    revenue_today: Number(revenueToday.total ?? 0),
    revenue_month: Number(revenueMonth.total ?? 0),
  }
}

// =============================================================
// 2. นักอ่าน — สมัครสมาชิก/login รายวัน + ผู้ใช้จ่ายเหรียญเยอะสุด
// =============================================================
export async function getReaderAnalytics(days: number) {
  const since = daysAgo(days - 1) // รวมวันนี้ด้วยเป็นวันที่ days นับจากซ้าย

  const [signupRows, loginRows, topSpenderRows] = await Promise.all([
    db.selectFrom('users')
      .select([DAY_TRUNC.as('day'), ({ fn }) => fn.countAll<string>().as('value')])
      .where('created_at', '>=', since)
      .where('deleted_at', 'is', null)
      .groupBy(DAY_TRUNC)
      .execute(),

    db.selectFrom('login_history')
      .select([DAY_TRUNC.as('day'), ({ fn }) => fn.count<string>('user_id').distinct().as('value')])
      .where('created_at', '>=', since)
      .where('user_id', 'is not', null)
      .groupBy(DAY_TRUNC)
      .execute(),

    db.selectFrom('coin_ledger as cl')
      .innerJoin('users as u', 'u.id', 'cl.user_id')
      .select(['u.uuid', 'u.display_name', 'u.u_name', ({ fn }) => fn.sum<string>('cl.delta').as('total_delta')])
      .where('cl.reason', '=', 'purchase')
      .where('cl.created_at', '>=', since)
      .groupBy(['u.uuid', 'u.display_name', 'u.u_name'])
      .orderBy('total_delta', 'asc') // delta เป็นค่าลบ — น้อยสุด (ติดลบเยอะสุด) = จ่ายเยอะสุด
      .limit(10)
      .execute(),
  ])

  return {
    signup_series: fillDailySeries(signupRows, days),
    dau_series: fillDailySeries(loginRows, days),
    top_spenders: topSpenderRows.map((r) => ({
      uuid: r.uuid,
      display_name: r.display_name,
      u_name: r.u_name,
      coins_spent: Number(-BigInt(r.total_delta)),
    })),
  }
}

// =============================================================
// 3. การเงิน — รายได้เติมเงิน/ยอดขายตอน/กำไรเว็บสุทธิ/ถอนเงิน/แพ็กเกจขายดี
// =============================================================
export async function getFinanceAnalytics(days: number) {
  const since = daysAgo(days - 1)

  const [topupRows, salesRows, platformNetRows, pendingWithdrawalRow, approvedWithdrawalRow, packageRows] = await Promise.all([
    db.selectFrom('topup_transactions')
      .select([DAY_TRUNC.as('day'), ({ fn }) => fn.sum<string | null>('amount_paid').as('value')])
      .where('status', '=', 'completed')
      .where('created_at', '>=', since)
      .groupBy(DAY_TRUNC)
      .execute(),

    db.selectFrom('ep_shop')
      .select([DAY_TRUNC.as('day'), ({ fn }) => fn.sum<string | null>('price').as('value')])
      .where('created_at', '>=', since)
      .groupBy(DAY_TRUNC)
      .execute(),

    // กำไรเว็บสุทธิต่อวัน = ยอดขายตอน × (1 - ส่วนแบ่งนักเขียน) — ใช้ withdrawal_rate ต่อคนถ้ามี
    // override ไม่งั้น fallback ตาม WITHDRAWAL_RATE (.env) เหมือน getWriterRevenueSummary()
    db.selectFrom('ep_shop as s')
      .innerJoin('works as w', 'w.p_id', 's.p_id')
      .innerJoin('users as u', 'u.id', 'w.author_id')
      .select([
        EP_SHOP_DAY_TRUNC.as('day'),
        sql<string>`SUM(s.price * (1 - COALESCE(u.withdrawal_rate, ${Number(process.env.WITHDRAWAL_RATE ?? '0.7')})))`.as('value'),
      ])
      .where('s.created_at', '>=', since)
      .groupBy(EP_SHOP_DAY_TRUNC)
      .execute(),

    db.selectFrom('withdrawals').select(({ fn }) => [fn.sum<string | null>('net_amount').as('total'), fn.countAll<string>().as('count')]).where('status', '=', 'pending').executeTakeFirstOrThrow(),
    db.selectFrom('withdrawals').select(({ fn }) => fn.sum<string | null>('net_amount').as('total')).where('status', '=', 'approved').where('approved_at', '>=', startOfMonth()).executeTakeFirstOrThrow(),

    db.selectFrom('topup_transactions as t')
      .leftJoin('topup_packages as p', 'p.id', 't.package_id')
      .select(['t.package_id', 'p.coin_amount', 'p.bonus', 'p.price', ({ fn }) => fn.countAll<string>().as('purchase_count')])
      .where('t.status', '=', 'completed')
      .where('t.created_at', '>=', since)
      .groupBy(['t.package_id', 'p.coin_amount', 'p.bonus', 'p.price'])
      .orderBy('purchase_count', 'desc')
      .execute(),
  ])

  return {
    topup_series: fillDailySeries(topupRows, days),
    sales_series: fillDailySeries(salesRows, days),
    platform_net_series: fillDailySeries(platformNetRows, days),
    withdrawals_pending: { total: Number(pendingWithdrawalRow.total ?? 0), count: Number(pendingWithdrawalRow.count) },
    withdrawals_approved_this_month: Number(approvedWithdrawalRow.total ?? 0),
    package_performance: packageRows.map((r) => ({
      package_id: r.package_id ? String(r.package_id) : null,
      coin_amount: r.coin_amount === null ? null : Number(r.coin_amount),
      bonus: r.bonus === null ? null : Number(r.bonus),
      price: r.price,
      purchase_count: Number(r.purchase_count),
    })),
  }
}

// =============================================================
// 4. การควบคุมเนื้อหา — รายงาน/แบน/ระงับ รายวัน
// =============================================================
export async function getModerationAnalytics(days: number) {
  const since = daysAgo(days - 1)

  const [reportsFiledRows, reportsResolvedRows, bansRows, activitySuspensionRows, spendSuspensionRows, pendingReportsRow] = await Promise.all([
    db.selectFrom('content_reports')
      .select([DAY_TRUNC.as('day'), ({ fn }) => fn.countAll<string>().as('value')])
      .where('created_at', '>=', since)
      .groupBy(DAY_TRUNC)
      .execute(),

    db.selectFrom('content_reports')
      .select([REVIEWED_DAY_TRUNC.as('day'), ({ fn }) => fn.countAll<string>().as('value')])
      .where('reviewed_at', 'is not', null)
      .where('reviewed_at', '>=', since)
      .groupBy(REVIEWED_DAY_TRUNC)
      .execute(),

    db.selectFrom('user_bans')
      .select([DAY_TRUNC.as('day'), ({ fn }) => fn.countAll<string>().as('value')])
      .where('created_at', '>=', since)
      .groupBy(DAY_TRUNC)
      .execute(),

    db.selectFrom('user_activity_suspensions')
      .select([DAY_TRUNC.as('day'), ({ fn }) => fn.countAll<string>().as('value')])
      .where('created_at', '>=', since)
      .groupBy(DAY_TRUNC)
      .execute(),

    db.selectFrom('user_spend_suspensions')
      .select([DAY_TRUNC.as('day'), ({ fn }) => fn.countAll<string>().as('value')])
      .where('created_at', '>=', since)
      .groupBy(DAY_TRUNC)
      .execute(),

    db.selectFrom('content_reports').select(({ fn }) => fn.countAll<string>().as('count')).where('status', '=', 'pending').executeTakeFirstOrThrow(),
  ])

  // รวม bans + activity suspensions + spend suspensions เป็นเส้นเดียว "การลงโทษ/ระงับ" ต่อวัน
  const penaltyMap = new Map<string, number>()
  for (const rows of [bansRows, activitySuspensionRows, spendSuspensionRows]) {
    for (const r of rows) {
      const key = dayKey(new Date(r.day))
      penaltyMap.set(key, (penaltyMap.get(key) ?? 0) + Number(r.value))
    }
  }
  const penaltyRows = [...penaltyMap.entries()].map(([day, value]) => ({ day, value }))

  return {
    reports_filed_series: fillDailySeries(reportsFiledRows, days),
    reports_resolved_series: fillDailySeries(reportsResolvedRows, days),
    penalty_series: fillDailySeries(penaltyRows, days),
    pending_reports: Number(pendingReportsRow.count),
  }
}
