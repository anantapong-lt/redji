import { AuthCard } from '@/components/auth/auth-card'
import { LoginForm } from '@/components/auth/login-form'
import { SITE_CONFIG } from '@/site.config'

export default function LoginPage() {
  return <AuthCard heading={`เข้าสู่ระบบของ ${SITE_CONFIG.name}`}><LoginForm /></AuthCard>
}
