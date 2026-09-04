import type { Metadata } from 'next'
import { AuthCard } from '@/components/auth/auth-card'
import { RegisterForm } from '@/components/auth/register-form'
import { SITE_CONFIG } from '@/site.config'

export const metadata: Metadata = {
  title: 'สมัครสมาชิก',
  description: `สมัครสมาชิก ${SITE_CONFIG.name} เพื่อเริ่มอ่านและติดตามเนื้อหาที่คุณชื่นชอบ`,
  alternates: { canonical: '/register' },
  robots: { index: true, follow: true },
}

export default function RegisterPage() {
  return <AuthCard heading={`สมัครสมาชิก ${SITE_CONFIG.name}`}><RegisterForm /></AuthCard>
}
