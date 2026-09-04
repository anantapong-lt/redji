import type { Metadata } from 'next'
import { AuthCard } from '@/components/auth/auth-card'
import { VerifyEmailResult } from '@/components/auth/verify-email-result'

export const metadata: Metadata = {
  title: 'ยืนยันอีเมล',
  robots: { index: false, follow: false },
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token = '' } = await searchParams

  return (
    <AuthCard heading="ยืนยันอีเมล">
      <VerifyEmailResult token={token} />
    </AuthCard>
  )
}
