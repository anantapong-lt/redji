'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { useAdminAuth } from '@/components/admin-auth-provider'
import { TurnstileWidget } from '@/components/turnstile-widget'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function AdminLoginPage() {
  const router = useRouter()
  const { login, status } = useAdminAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [turnstileKey, setTurnstileKey] = useState(0)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await login(email, password, turnstileToken ?? undefined)
      router.replace('/site')
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'เข้าสู่ระบบไม่สำเร็จ')
    } finally {
      setIsSubmitting(false)
      setTurnstileToken(null)
      setTurnstileKey((current) => current + 1)
    }
  }

  return (
    <main className="login-page">
      <div className="login-backdrop" aria-hidden="true" />
      <Card className="login-card" aria-label="Readji Admin login">
        <CardContent className="login-card-content">

          <CardHeader className="login-card-heading">
            <CardTitle>เข้าสู่ระบบ</CardTitle>
          </CardHeader>

          <form onSubmit={handleSubmit} aria-busy={isSubmitting || status === 'loading'}>
            <div className="login-field">
              <Label htmlFor="email">อีเมล</Label>
              <span className="input-wrap">
                <Mail aria-hidden="true" />
                <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@readji.com" autoComplete="email" required />
              </span>
            </div>

            <div className="login-field">
              <Label htmlFor="password">รหัสผ่าน</Label>
              <span className="input-wrap">
                <LockKeyhole aria-hidden="true" />
                <Input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="กรอกรหัสผ่าน" autoComplete="current-password" required />
                <Button type="button" variant="ghost" size="icon" className="password-toggle" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </Button>
              </span>
            </div>

            <TurnstileWidget key={turnstileKey} onTokenChange={setTurnstileToken} />

            {error && <Alert className="login-error" role="alert">{error}</Alert>}

            <Button className="login-submit" size="lg" type="submit" disabled={isSubmitting || status === 'loading' || (process.env.NODE_ENV !== 'development' && !turnstileToken)}>
              {isSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
