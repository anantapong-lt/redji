'use client'

import { useState } from 'react'
import { BadgeCheck, QrCode, ShieldCheck } from 'lucide-react'
import { SITE_CONFIG } from '@/site.config'

const PRESET_AMOUNTS = [50, 100, 300, 500, 1_000, 3_000] as const

function formatNumber(value: number) {
  return value.toLocaleString('th-TH')
}

export function TopupForm() {
  const [amount, setAmount] = useState(50)
  const [customAmount, setCustomAmount] = useState('50')

  function selectAmount(value: number) {
    setAmount(value)
    setCustomAmount(String(value))
  }

  function changeCustomAmount(value: string) {
    const digits = value.replace(/\D/g, '')
    setCustomAmount(digits)
    setAmount(Number(digits) || 0)
  }

  return (
    <div className="mt-5 space-y-3 sm:mt-7 sm:space-y-4">
      <section className="readji-surface rounded-xl p-3 sm:rounded-2xl sm:p-5" aria-labelledby="payment-method-heading">
        <h2 id="payment-method-heading" className="text-sm font-bold text-foreground sm:text-base">
          เลือกช่องทางชำระเงิน
        </h2>

        <div className="mt-3 flex items-center gap-3 rounded-xl border-2 border-primary bg-accent/45 p-3 sm:mt-4 sm:p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary sm:size-12">
            <QrCode className="size-6 sm:size-7" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-foreground sm:text-base">คิวอาร์โค้ด</p>
              <BadgeCheck className="size-4 fill-primary text-primary-foreground" />
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">ชำระผ่านแอปธนาคาร</p>
          </div>
        </div>
      </section>

      <section className="readji-surface rounded-xl p-3 sm:rounded-2xl sm:p-5" aria-labelledby="topup-amount-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="topup-amount-heading" className="text-sm font-bold text-foreground sm:text-base">จำนวนเงิน</h2>
          <span className="text-[10px] text-muted-foreground sm:text-xs">1 บาท = 1 {SITE_CONFIG.coinName}</span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:gap-3">
          {PRESET_AMOUNTS.map((value) => {
            const selected = amount === value && customAmount === String(value)

            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => selectAmount(value)}
                className={`rounded-lg border px-2 py-2 text-xs font-semibold tabular-nums transition-colors sm:py-2.5 sm:text-sm ${
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-secondary text-secondary-foreground hover:border-primary/50 hover:bg-accent'
                }`}
              >
                {formatNumber(value)} ฿
              </button>
            )
          })}
        </div>

        <label className="mt-3 block rounded-lg border border-border bg-background/70 px-3 py-2 sm:mt-4 sm:px-4 sm:py-3">
          <span className="block text-[10px] text-muted-foreground sm:text-xs">ระบุจำนวนเงินด้วยตัวเอง</span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground sm:text-sm">THB</span>
            <input
              type="text"
              inputMode="numeric"
              value={customAmount}
              onChange={(event) => changeCustomAmount(event.target.value)}
              aria-label="จำนวนเงินที่ต้องการเติม"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold tabular-nums text-foreground outline-none sm:text-base"
            />
          </span>
        </label>

        <div className="mt-3 rounded-lg border border-border p-3 text-xs sm:mt-4 sm:p-4 sm:text-sm">
          <div className="flex items-center justify-between gap-4 py-1">
            <span className="text-muted-foreground">{SITE_CONFIG.coinName}พื้นฐาน</span>
            <span className="font-semibold tabular-nums text-foreground">{formatNumber(amount)} {SITE_CONFIG.coinName}</span>
          </div>
          <div className="flex items-center justify-between gap-4 py-1">
            <span className="text-muted-foreground">โบนัส (+0%)</span>
            <span className="font-semibold tabular-nums text-muted-foreground">0 {SITE_CONFIG.coinName}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-4 border-t border-border pt-3">
            <span className="font-bold text-foreground">รวมที่จะได้รับ</span>
            <span className="text-base font-bold tabular-nums text-primary sm:text-lg">
              {formatNumber(amount)} {SITE_CONFIG.coinName}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled
          className="mt-3 w-full cursor-not-allowed rounded-lg bg-muted px-4 py-2.5 text-xs font-semibold text-muted-foreground sm:mt-4 sm:text-sm"
        >
          ระบบชำระเงินยังไม่เปิดใช้งาน
        </button>

        <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground sm:text-xs">
          <ShieldCheck className="size-3.5 text-primary" />
          ไม่มีการเรียกเก็บเงินจริงในหน้านี้
        </div>
      </section>
    </div>
  )
}
