import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { WalletCards } from 'lucide-react'
import { getServerAuthUser } from '@/lib/server-auth'
import { SITE_CONFIG } from '@/site.config'
import { TopupForm } from './topup-form'

export const metadata: Metadata = {
  title: `เติม${SITE_CONFIG.coinName}`,
  description: `เลือกแพ็กเกจเพื่อเติม${SITE_CONFIG.coinName}สำหรับอ่านตอนที่คุณชื่นชอบ`,
}

function formatNumber(value: number | string) {
  return Number(value).toLocaleString('th-TH')
}

export default async function TopupPage() {
  const user = await getServerAuthUser()

  if (!user) redirect('/login')

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-4 sm:py-8 md:px-8 md:py-10">
      <section className="flex items-center justify-between gap-3 border-b border-border pb-4 sm:gap-4 sm:pb-6">
        <div>
          <h1 className="readji-page-title text-xl sm:text-2xl md:text-3xl">เติม{SITE_CONFIG.coinName}</h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">เลือกแพ็กเกจสำหรับปลดล็อกตอนที่ต้องการอ่าน</p>
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-card/80 px-3 py-2 sm:min-w-56 sm:gap-3 sm:rounded-xl sm:px-4 sm:py-3">
          <WalletCards className="size-4 shrink-0 text-primary sm:size-5" />
          <div>
            <p className="text-[10px] font-medium text-muted-foreground sm:text-[11px]">ยอดคงเหลือ</p>
            <p className="text-base font-bold leading-tight tabular-nums text-foreground sm:text-lg">
              {formatNumber(user.balance)}
              <span className="ml-1 text-[10px] font-semibold text-muted-foreground sm:text-xs">{SITE_CONFIG.coinName}</span>
            </p>
          </div>
        </div>
      </section>

      <TopupForm />
    </div>
  )
}
