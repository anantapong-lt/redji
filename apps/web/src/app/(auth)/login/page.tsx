import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthCard } from '@/components/auth/auth-card'
import { LoginForm } from '@/components/auth/login-form'
import { userRole } from '@/interface/user.interface'
import { getServerAuthUser, getServerFeatureConfig } from '@/lib/server-auth'
import { SITE_CONFIG } from '@/site.config'

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ',
  description: `เข้าสู่ระบบ ${SITE_CONFIG.name} เพื่ออ่านและติดตามเนื้อหาที่คุณชื่นชอบ`,
  alternates: { canonical: '/login' },
  robots: { index: true, follow: true },
}

export default async function LoginPage() {
  const [user, features] = await Promise.all([getServerAuthUser(), getServerFeatureConfig()])

  if (user) redirect('/');

  return <AuthCard heading={`เข้าสู่ระบบของ ${SITE_CONFIG.name}`}><LoginForm registrationEnabled={features?.registration === true} /></AuthCard>
}
