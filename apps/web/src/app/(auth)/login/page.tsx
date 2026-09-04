import type { Metadata } from 'next'
import { AuthCard } from '@/components/auth/auth-card'
import { LoginForm } from '@/components/auth/login-form'
import { SITE_CONFIG } from '@/site.config'

export const metadata: Metadata = {
  title: 'เข้าสู่ระบบ',
  description: `เข้าสู่ระบบ ${SITE_CONFIG.name} เพื่ออ่านและติดตามเนื้อหาที่คุณชื่นชอบ`,
  alternates: { canonical: '/login' },
  robots: { index: true, follow: true },
}

export default function LoginPage() {
  return <AuthCard heading={`เข้าสู่ระบบของ ${SITE_CONFIG.name}`}><LoginForm /></AuthCard>
}
