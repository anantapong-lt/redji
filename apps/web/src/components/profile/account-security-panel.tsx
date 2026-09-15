'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Link2, Mail, ShieldCheck } from 'lucide-react'
import { FcGoogle } from 'react-icons/fc'
import { useAuth } from '@/components/auth/auth-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getAccountSecurity } from '@/controllers/auth.controller'
import type { AccountSecurity } from '@/interface/account-security.interface'
import { SITE_CONFIG } from '@/site.config'

export function AccountSecurityPanel() {
  const { accessToken } = useAuth()
  const searchParams = useSearchParams()
  const [account, setAccount] = useState<AccountSecurity | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [isConnecting, setIsConnecting] = useState(false)
  const oauthError = searchParams.get('oauth_error')

  useEffect(() => {
    if (!accessToken) return
    let cancelled = false
    setError(null)
    getAccountSecurity(accessToken)
      .then(({ account: result }) => { if (!cancelled) setAccount(result) })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'ไม่สามารถโหลดข้อมูลความปลอดภัยได้')
      })
    return () => { cancelled = true }
  }, [accessToken, retry])

  const linked = Boolean(account?.google_linked_at)

  return (
    <div className="min-w-0 space-y-4">
      {oauthError && <p role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">{oauthError}</p>}
      {searchParams.get('google_linked') === '1' && linked && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary"><CheckCircle2 className="size-4 shrink-0" />เชื่อมบัญชี Google สำเร็จแล้ว</p>
      )}
      {error ? (
        <div role="alert" className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={() => setRetry((value) => value + 1)}>ลองใหม่</Button>
        </div>
      ) : !account ? (
        <div role="status" aria-label="กำลังโหลดข้อมูลความปลอดภัย" className="space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <section aria-label="อีเมลบัญชี" className="flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Mail className="size-5 text-muted-foreground" /></span>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold">อีเมล</h3>
              <p className="break-all text-sm text-muted-foreground">{account.email}</p>
            </div>
            <Badge variant={account.email_verified ? 'secondary' : 'outline'}>{account.email_verified ? 'ยืนยันแล้ว' : 'ยังไม่ได้ยืนยัน'}</Badge>
          </section>
          <section aria-labelledby="linked-accounts-heading" className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
            <h2 id="linked-accounts-heading" className="text-lg font-bold">บัญชีที่เชื่อมต่อ</h2>
            <p className="mt-1 text-sm text-muted-foreground">จัดการบัญชีที่ใช้เข้าสู่ระบบ</p>
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background"><FcGoogle className="size-6" /></span>
                <div className="min-w-0">
                  <h3 className="font-semibold">Google</h3>
                  <p className="break-all text-sm text-muted-foreground">{linked ? account.google_email : 'ยังไม่ได้เชื่อมต่อ'}</p>
                </div>
              </div>
              {linked ? (
                <Badge variant="secondary" className="gap-1.5 self-start sm:self-auto"><CheckCircle2 className="size-3.5" />เชื่อมต่อแล้ว</Badge>
              ) : (
                <Button variant="outline" disabled={isConnecting} onClick={() => {
                  setIsConnecting(true)
                  window.location.assign(new URL('/auth/google/link', SITE_CONFIG.apiUrl).toString())
                }}><FcGoogle className="size-5" />{isConnecting ? 'กำลังเชื่อมต่อ...' : 'เชื่อม Google'}</Button>
              )}
            </div>
            {!linked && <p className="mt-5 flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-xs leading-5 text-muted-foreground"><Link2 className="mt-0.5 size-4 shrink-0" />เลือกบัญชี Google ที่ใช้อีเมลเดียวกับบัญชีนี้ เมื่อเชื่อมต่อแล้ว คุณจะเข้าสู่ระบบด้วย Google ได้</p>}
          </section>
          <div className="flex items-start gap-3 px-1 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" /><p>การเชื่อมบัญชี Google ต้องทำหลังจากเข้าสู่ระบบบัญชีของคุณแล้วเท่านั้น</p></div>
        </>
      )}
    </div>
  )
}
