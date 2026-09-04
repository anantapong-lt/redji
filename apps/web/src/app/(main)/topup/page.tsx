import type { Metadata } from 'next'
import { getServerAuthUser } from '@/lib/server-auth'
import { SITE_CONFIG } from '@/site.config'
import { TopupBalance } from './topup-balance'
import { TopupForm } from './topup-form'

export const metadata: Metadata = {
  title: `เติม${SITE_CONFIG.coinName}`,
  description: `เลือกแพ็กเกจเพื่อเติม${SITE_CONFIG.coinName}สำหรับอ่านตอนที่คุณชื่นชอบ`,
  alternates: { canonical: '/topup' },
  robots: { index: true, follow: true },
}

export default async function TopupPage() {
  const user = await getServerAuthUser()

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-4 sm:py-8 md:px-8 md:py-10">
      <section className="flex items-center justify-between gap-3 border-b border-border pb-4 sm:gap-4 sm:pb-6">
        <div>
          <h1 className="readji-page-title text-xl sm:text-2xl md:text-3xl">เติม{SITE_CONFIG.coinName}</h1>
          <p className="mt-1 hidden text-sm text-muted-foreground sm:block">เลือกแพ็กเกจสำหรับปลดล็อกตอนที่ต้องการอ่าน</p>
        </div>

        {user && <TopupBalance initialBalance={user.balance} />}
      </section>

      <TopupForm />
    </div>
  )
}
