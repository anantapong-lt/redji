import { AuthCard } from '@/components/auth/auth-card'
import { RegisterForm } from '@/components/auth/register-form'
import { SITE_CONFIG } from '@/site.config'

export default function RegisterPage() {
  return (
    <AuthCard heading={`สมัครสมาชิก ${SITE_CONFIG.name}`}>
      <RegisterForm />
    </AuthCard>
  )
}
