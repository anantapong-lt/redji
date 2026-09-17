import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getServerAuthUser } from '@/lib/server-auth'
import { TransactionsHistory } from './transactions-history'

export const metadata: Metadata = {
  title: 'ประวัติทำรายการ',
  description: 'ตรวจสอบประวัติการเติมเงินและการซื้อตอน',
  alternates: { canonical: '/transactions' },
  robots: { index: false, follow: false },
}

export default async function TransactionsPage() {
  const user = await getServerAuthUser()
  if (!user) redirect('/login?next=/transactions')

  return <TransactionsHistory />
}
