'use client'

/**
 * components/writers/writer-detail-modal.tsx — ปุ่ม "ดูเพิ่มเติม" ในตาราง "นักเขียนของเว็บ"
 * (2026-08-04, แทนที่ปุ่ม "ถอดสถานะ" เดิมที่เป็นปุ่มลอยเดี่ยวๆ ในตาราง)
 *
 * รวม 3 อย่างในหน้าต่างเดียวตามที่ user ขอ:
 * - "ข้อมูลใบสมัคร" — ข้อมูลที่นักเขียนกรอกตอนสมัคร (บัตร ปชช./ที่อยู่/บัญชีธนาคาร) จาก
 *   getWriterApplicationForUser() — null ได้ (เช่น legacy level 7 หรือแอดมินที่มีผลงานแต่ไม่เคย
 *   สมัครผ่านฟอร์มจริง) โชว์ข้อความอธิบายแทนถ้าไม่มี
 * - "ผลงาน" — ลิสต์เรื่องที่เขียนทั้งหมด จาก getWriterWorksList()
 * - ปุ่ม "ถอดสถานะนักเขียน" (level 6/7 → 1) ย้ายมาจากปุ่มเดี่ยวในตารางเดิม — ซ่อนถ้าเป็นแอดมิน
 *   (level >= 8 ที่โผล่มาเพราะมีผลงาน ไม่เกี่ยวกับสถานะนักเขียนของเขา)
 */

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { formatCompactNumber, formatThaiDateTime } from '@/lib/utils'
import { useAdminUser } from '@/store/auth.store'
import type { AdminUserRow, WriterApplicationDetail, WriterWorkRow, Pagination } from '@/types'

interface RevenueRateData {
  custom_percent: number | null
  baseline_percent: number
  effective_percent: number
  min_percent: number
  max_percent: number
}

interface RevenueSummaryData {
  gross_coin_sales: number
  writer_share: number
  platform_revenue: number
  purchase_count: number
}

const TABS = [
  { key: 'application', label: 'ข้อมูลใบสมัคร' },
  { key: 'works', label: 'ผลงาน' },
  { key: 'revenue', label: 'ส่วนแบ่งรายได้' },
] as const
type TabKey = (typeof TABS)[number]['key']

const APP_STATUS_LABEL: Record<string, string> = {
  pending: 'รอตรวจสอบ',
  approve: 'อนุมัติแล้ว',
  rejected: 'ปฏิเสธแล้ว',
}

const APP_TYPE_LABEL: Record<string, string> = {
  new_writer: 'ขอเป็นนักเขียนใหม่',
  edit: 'แก้ไขข้อมูล',
}

const COMPLETION_LABEL: Record<string, string> = {
  ongoing: 'กำลังเขียน',
  completed: 'จบแล้ว',
  hiatus: 'พักการเขียน',
}

export function WriterDetailModal({
  user,
  onClose,
}: {
  user: AdminUserRow | null
  onClose: () => void
}) {
  const me = useAdminUser()
  const myLevel = me?.level ?? 0
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabKey>('application')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rateInput, setRateInput] = useState('')
  const [rateBusy, setRateBusy] = useState(false)
  const [rateError, setRateError] = useState<string | null>(null)

  const appQuery = useQuery({
    queryKey: ['admin', 'writer-application-detail', user?.uuid],
    queryFn: () => api.get<{ data: WriterApplicationDetail | null }>(`/admin/users/${user!.uuid}/writer-application`),
    enabled: Boolean(user),
  })

  const worksQuery = useQuery({
    queryKey: ['admin', 'writer-works', user?.uuid],
    queryFn: () => api.get<{ data: WriterWorkRow[]; pagination: Pagination }>(`/admin/users/${user!.uuid}/works?limit=20`),
    enabled: Boolean(user),
  })

  const revenueQuery = useQuery({
    queryKey: ['admin', 'writer-revenue-rate', user?.uuid],
    queryFn: () => api.get<{ data: RevenueRateData }>(`/admin/users/${user!.uuid}/revenue-rate`),
    enabled: Boolean(user) && tab === 'revenue',
  })

  const revenueSummaryQuery = useQuery({
    queryKey: ['admin', 'writer-revenue-summary', user?.uuid],
    queryFn: () => api.get<{ data: RevenueSummaryData }>(`/admin/users/${user!.uuid}/revenue-summary`),
    enabled: Boolean(user) && tab === 'revenue',
  })

  // เติมค่าเริ่มต้นในช่องกรอกจากข้อมูลจริงตอนโหลดเสร็จ (ครั้งเดียวต่อการเปิด modal/โหลดข้อมูลใหม่)
  useEffect(() => {
    const rate = revenueQuery.data?.data
    if (rate) setRateInput(String(rate.custom_percent ?? rate.baseline_percent))
  }, [revenueQuery.data])

  async function handleSaveRate() {
    if (!user) return
    const rate = revenueQuery.data?.data
    if (!rate) return
    const value = Number(rateInput)
    if (Number.isNaN(value) || value < rate.min_percent || value > rate.max_percent) {
      setRateError(`ตั้งได้แค่ ${rate.min_percent}-${rate.max_percent}% เท่านั้น (±${rate.max_percent - rate.baseline_percent} จากค่ากลาง ${rate.baseline_percent}%)`)
      return
    }
    setRateError(null)
    setRateBusy(true)
    try {
      await api.patch(`/admin/users/${user.uuid}/revenue-rate`, { rate_percent: value })
      queryClient.invalidateQueries({ queryKey: ['admin', 'writer-revenue-rate', user.uuid] })
    } catch (err: any) {
      setRateError(err?.message ?? 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setRateBusy(false)
    }
  }

  async function handleResetRate() {
    if (!user) return
    setRateError(null)
    setRateBusy(true)
    try {
      await api.patch(`/admin/users/${user.uuid}/revenue-rate`, { rate_percent: null })
      queryClient.invalidateQueries({ queryKey: ['admin', 'writer-revenue-rate', user.uuid] })
    } catch (err: any) {
      setRateError(err?.message ?? 'รีเซ็ตไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setRateBusy(false)
    }
  }

  async function handleRevoke() {
    if (!user) return
    if (!window.confirm(`ถอดสถานะนักเขียนของ ${user.display_name} (@${user.u_name}) ใช่หรือไม่?`)) return
    setError(null)
    setBusy(true)
    try {
      await api.patch(`/admin/users/${user.uuid}/level`, { level: 1 })
      queryClient.invalidateQueries({ queryKey: ['admin', 'writers-approved'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      onClose()
    } catch (err: any) {
      setError(err?.message ?? 'ถอดสถานะไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  if (!user) return null

  const app = appQuery.data?.data
  const works = worksQuery.data?.data ?? []

  return (
    <Modal open={Boolean(user)} onClose={onClose} title={`${user.display_name} (@${user.u_name})`} size="lg">
      <div className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? 'cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground'
                : 'cursor-pointer rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted'
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {tab === 'application' ? (
        appQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : !app ? (
          <p className="text-sm text-muted-foreground">
            ไม่มีข้อมูลใบสมัคร — เป็นบัญชีที่ไม่เคยผ่านฟอร์มสมัครนักเขียนจริง (เช่น legacy หรือแอดมินที่มีผลงานแต่ไม่ได้เป็นนักเขียนโดยตรง)
          </p>
        ) : (
          <div className="flex flex-col gap-1.5 text-sm">
            <DetailRow label="ชื่อ-นามสกุล" value={`${app.user_prefix}${app.first_name} ${app.last_name}`} />
            <DetailRow label="เลขบัตรประชาชน" value={app.national_id} />
            <DetailRow
              label="ที่อยู่ตามบัตร"
              value={[app.id_address, app.id_subdistrict, app.id_district, app.id_province, app.id_postal_code]
                .filter(Boolean)
                .join(' ')}
            />
            <DetailRow
              label="ที่อยู่ปัจจุบัน"
              value={[
                app.current_address,
                app.current_subdistrict,
                app.current_district,
                app.current_province,
                app.current_postal_code,
              ]
                .filter(Boolean)
                .join(' ')}
            />
            <DetailRow label="เบอร์โทรศัพท์" value={app.user_phone} />
            <DetailRow label="ธนาคาร" value={app.bank_name} />
            <DetailRow label="สาขา" value={app.bank_branch} />
            <DetailRow label="เลขบัญชี" value={app.bank_number} />
            <DetailRow label="ประเภทคำขอล่าสุด" value={APP_TYPE_LABEL[app.application_type] ?? app.application_type} />
            <DetailRow label="สถานะใบสมัคร" value={APP_STATUS_LABEL[app.status] ?? app.status} />
            {app.reject_reason && <DetailRow label="เหตุผลที่ปฏิเสธ (ครั้งก่อน)" value={app.reject_reason} />}
            <DetailRow label="ส่งใบสมัครเมื่อ" value={formatThaiDateTime(app.created_at)} />
          </div>
        )
      ) : tab === 'works' ? (
        worksQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : works.length === 0 ? (
          <p className="text-sm text-muted-foreground">ยังไม่มีผลงาน</p>
        ) : (
          <div className="flex flex-col gap-2">
            {works.map((w) => (
              <div key={w.uuid} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">{w.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {w.type === 'novel' ? 'นิยาย' : 'การ์ตูน'} · {w.publish_status ? 'เผยแพร่แล้ว' : 'ฉบับร่าง'}
                    {w.completion_status ? ` · ${COMPLETION_LABEL[w.completion_status] ?? w.completion_status}` : ''}
                    {' · '}
                    {formatThaiDateTime(w.created_at)}
                  </div>
                </div>
                <div className="shrink-0 text-xs text-muted-foreground" title={`${Number(w.view_count).toLocaleString('en-US')} ครั้ง`}>{formatCompactNumber(w.view_count)} ครั้ง</div>
              </div>
            ))}
          </div>
        )
      ) : revenueQuery.isLoading || revenueSummaryQuery.isLoading || !revenueQuery.data || !revenueSummaryQuery.data ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : (
        (() => {
          const rate = revenueQuery.data.data
          const summary = revenueSummaryQuery.data.data
          const isCustom = rate.custom_percent !== null
          return (
            <div className="flex flex-col gap-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-3">
                <RevenueMetric
                  label="ยอดซื้อจากเหรียญ"
                  value={`${formatCompactNumber(summary.gross_coin_sales)} เหรียญ`}
                  detail={`${formatCompactNumber(summary.purchase_count)} รายการซื้อ`}
                  tone="amber"
                />
                <RevenueMetric
                  label="ส่วนของนักเขียน"
                  value={`${formatCompactNumber(summary.writer_share)} เหรียญ`}
                  detail={`ตามอัตราส่วน ${rate.effective_percent}%`}
                  tone="primary"
                />
                <RevenueMetric
                  label="รายได้ฝั่งเว็บ"
                  value={`${formatCompactNumber(summary.platform_revenue)} เหรียญ`}
                  detail="ส่วนต่างหลังแบ่งให้นักเขียน"
                  tone="slate"
                />
              </div>
              <p className="text-xs text-muted-foreground">ยอดซื้อคำนวณจากรายการซื้อจริงทั้งหมด จึงไม่ลดลงเมื่ออนุมัติการถอนเงิน</p>
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">ส่วนแบ่งรายได้ปัจจุบัน</p>
                  <p className="text-xl font-bold text-foreground">
                    {rate.effective_percent}% {isCustom && <span className="text-xs font-normal text-primary">(ปรับเฉพาะคน)</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ค่ากลางของเว็บ</p>
                  <p className="text-xl font-bold text-muted-foreground">{rate.baseline_percent}%</p>
                </div>
              </div>

              {rateError && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {rateError}
                </p>
              )}

              {myLevel >= 9 ? (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-32">
                    <label className="mb-1.5 block text-xs font-medium text-foreground">ตั้งใหม่ (%)</label>
                    <Input
                      type="number"
                      min={rate.min_percent}
                      max={rate.max_percent}
                      value={rateInput}
                      onChange={(e) => setRateInput(e.target.value)}
                    />
                  </div>
                  <Button className="h-9 text-xs" disabled={rateBusy} onClick={handleSaveRate}>
                    บันทึก
                  </Button>
                  {isCustom && (
                    <Button variant="outline" className="h-9 text-xs" disabled={rateBusy} onClick={handleResetRate}>
                      รีเซ็ตเป็นค่ากลาง
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground">
                    ปรับได้ {rate.min_percent}-{rate.max_percent}% เท่านั้น
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">ต้องเป็นแอดมินรองขึ้นไป (level ≥ 9) ถึงจะปรับส่วนแบ่งรายได้ได้ — ดูได้อย่างเดียว</p>
              )}
            </div>
          )
        })()
      )}

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        {user.level < 8 ? (
          <Button variant="destructive" className="h-8 text-xs" disabled={busy} onClick={handleRevoke}>
            ถอดสถานะนักเขียน
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">เป็นแอดมิน — ไม่เกี่ยวกับสถานะนักเขียน</span>
        )}
        <Button variant="outline" className="h-8 text-xs" onClick={onClose}>
          ปิด
        </Button>
      </div>
    </Modal>
  )
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <span className="w-40 shrink-0 text-muted-foreground">{label}</span>
      <span className="text-foreground">{value || '—'}</span>
    </div>
  )
}

function RevenueMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone: 'amber' | 'primary' | 'slate'
}) {
  const toneClass = {
    amber: 'border-amber-200 bg-amber-50/70',
    primary: 'border-primary/15 bg-primary/5',
    slate: 'border-border bg-muted/45',
  }[tone]

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  )
}
