'use client'

/**
 * app/(main)/topup/page.tsx — "เติมเหรียญ" (2026-08-06, ใหม่)
 *
 * อ้างอิงเลย์เอาต์จาก ReadToon (PDF ที่ user ส่งมา) แต่ตัด section "โบนัสเหรียญ" (ตัวเลือกขั้นบันได
 * 50/100/300/500/1K แยกต่างหากจากปุ่มเลือกจำนวนเงิน) ทิ้งทั้งหมดตามที่ user ขอ — "ให้มีแค่ตามใน DB
 * ก็พอ" หมายถึงโบนัสมาจากแพ็กเกจที่เลือกโดยตรง (topup_packages.bonus) ไม่ใช่ระบบขั้นบันไดแยก
 *
 * ช่องทางชำระเงิน — ตอนนี้มีแค่คิวอาร์โค้ดทางเดียว (payment_method hardcode 'promptpay') เลย
 * โชว์เป็นการ์ดที่ "เลือกอยู่แล้ว" เฉยๆ ไม่ต้องทำ selector จริงจัง (schema เผื่อ 'truemoney' ไว้
 * แต่ user ไม่ได้ขอช่องทางนั้นตอนนี้)
 */

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QrCode, Check, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { TopupQRModal } from '@/components/topup/topup-qr-modal'
import { TopupHistorySection } from '@/components/topup/topup-history-section'
import type { TopupPackage, TopupInitiateResponse } from '@/types'

function bonusPercent(pkg: TopupPackage): number {
  const coin = Number(pkg.coin_amount)
  if (coin <= 0) return 0
  return Math.round((Number(pkg.bonus) / coin) * 100)
}

export default function TopupPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modalData, setModalData] = useState<TopupInitiateResponse | null>(null)
  const [initiating, setInitiating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: packages, isLoading } = useQuery({
    queryKey: ['topup', 'packages'],
    queryFn: () => api.get<{ data: TopupPackage[] }>('/topup/packages').then((r) => r.data),
  })

  // เลือกแพ็กเกจถูกสุด (รายการแรก — backend sort ราคาน้อยไปมากอยู่แล้ว) ให้เองเป็นค่าเริ่มต้น ตามที่
  // user ขอ ("ให้เลือก Default เป็น 50 อยู่แล้ว") — ทำเป็น effect ไม่ hardcode ค่า "50" ตรงๆ เพราะ
  // แพ็กเกจถูกสุดอาจเปลี่ยนได้ในอนาคต (แอดมินซ่อน/เพิ่มแพ็กเกจ) ให้ยึดตามข้อมูลจริงเสมอ
  useEffect(() => {
    if (packages && packages.length > 0 && selectedId === null) {
      setSelectedId(packages[0].id)
    }
  }, [packages, selectedId])

  const selected = packages?.find((p) => p.id === selectedId) ?? null

  async function handleContinue() {
    if (!selected) return
    setError(null)
    setInitiating(true)
    try {
      const res = await api.post<{ data: TopupInitiateResponse }>('/topup/initiate', {
        package_id: Number(selected.id),
        payment_method: 'promptpay',
      })
      setModalData(res.data)
    } catch (err: any) {
      setError(err?.message ?? 'เริ่มรายการไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setInitiating(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-6 text-2xl font-bold text-foreground">เติมเหรียญ</h1>

      <div className="mb-4 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">เลือกช่องทางชำระเงิน</h2>
        <div className="flex items-center gap-3 rounded-xl border-2 border-primary bg-primary/5 px-4 py-3">
          <QrCode className="size-6 shrink-0 text-primary" />
          <p className="text-sm font-medium text-foreground">คิวอาร์โค้ด</p>
          <Check className="ml-auto size-5 shrink-0 text-primary" />
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">จำนวนเงิน</h2>

        {isLoading ? (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="rounded-xl border-2 border-border px-3 py-3">
                <Skeleton className="mx-auto h-5 w-12" />
                <Skeleton className="mx-auto mt-2 h-3 w-8" />
              </div>
            ))}
          </div>
        ) : !packages || packages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีแพ็กเกจให้เลือกตอนนี้</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {packages.map((pkg) => {
              const percent = bonusPercent(pkg)
              const isSelected = selectedId === pkg.id
              return (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => setSelectedId(pkg.id)}
                  className={cn(
                    'relative cursor-pointer rounded-xl border-2 px-3 py-3 text-center transition-colors',
                    isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                  )}
                >
                  {isSelected && (
                    <CheckCircle2 className="absolute -top-2 -left-2 size-5 rounded-full bg-background text-emerald-500" />
                  )}
                  <p className="font-bold text-foreground">{Number(pkg.price).toLocaleString()} ฿</p>
                  {percent > 0 && <p className="text-xs font-medium text-emerald-600">+{percent}%</p>}
                </button>
              )
            })}
          </div>
        )}

        {selected && (
          <div className="mt-4 rounded-lg bg-muted/40 p-3 text-sm">
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">เหรียญพื้นฐาน</span>
              <span className="text-foreground">{Number(selected.coin_amount).toLocaleString()} เหรียญ</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">โบนัส (+{bonusPercent(selected)}%)</span>
              <span className={Number(selected.bonus) > 0 ? 'text-emerald-600' : 'text-muted-foreground'}>
                {Number(selected.bonus) > 0 ? '+' : ''}
                {Number(selected.bonus).toLocaleString()} เหรียญ
              </span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-2 font-bold text-foreground">
              <span>รวมที่จะได้รับ</span>
              <span className="text-primary">{Number(selected.total_coins).toLocaleString()} เหรียญ</span>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button className="w-full" disabled={!selected || initiating} onClick={handleContinue}>
        {initiating ? 'กำลังดำเนินการ...' : 'ดำเนินการต่อ'}
      </Button>

      <TopupQRModal data={modalData} onClose={() => setModalData(null)} />

      <TopupHistorySection />
    </div>
  )
}
