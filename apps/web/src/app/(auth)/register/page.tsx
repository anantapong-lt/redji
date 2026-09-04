import type { Metadata } from 'next'
import { AuthCard } from '@/components/auth/auth-card'
import { RegisterForm } from '@/components/auth/register-form'
import { SITE_CONFIG } from '@/site.config'
import { getServerAuthUser } from '@/lib/server-auth'
import { redirect } from 'next/dist/client/components/navigation'

export const metadata: Metadata = {
  title: 'สมัครสมาชิก',
  description: `สมัครสมาชิก ${SITE_CONFIG.name} เพื่อเริ่มอ่านและติดตามเนื้อหาที่คุณชื่นชอบ`,
  alternates: { canonical: '/register' },
  robots: { index: true, follow: true },
}

export default async function RegisterPage() {
  const user = await getServerAuthUser()

  if (user) redirect('/');

  return <AuthCard heading={`สมัครสมาชิก ${SITE_CONFIG.name}`}><RegisterForm /></AuthCard>
}
