'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoaderCircle, Sparkles } from 'lucide-react'
import { useAuth } from '@/components/auth/auth-provider'

function GoogleLoadingScreen() {
  return (
    <main className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_20%,hsl(var(--primary)/0.12),transparent_42%)]" />
      <section role="status" aria-live="polite" className="w-full max-w-sm rounded-3xl border border-border/70 bg-card p-8 text-center shadow-xl shadow-primary/5 sm:p-10">
        <div className="mx-auto flex size-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <div className="relative flex size-12 items-center justify-center">
            <LoaderCircle className="absolute size-12 animate-spin" strokeWidth={2.25} aria-hidden="true" />
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
        </div>
        <h1 className="mt-7 text-xl font-bold tracking-tight text-foreground">กำลังเข้าสู่ระบบด้วย Google</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">กำลังยืนยันตัวตนและเตรียมบัญชีของคุณ</p>
        <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-2/3 rounded-full bg-primary" style={{ animation: 'google-oauth-progress 1.35s ease-in-out infinite' }} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">กรุณารอสักครู่</p>
        <style>{`@keyframes google-oauth-progress { 0% { transform: translateX(-105%); } 50% { transform: translateX(50%); } 100% { transform: translateX(105%); } }`}</style>
      </section>
    </main>
  )
}

function GoogleCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refresh } = useAuth()

  useEffect(() => {
    const next = searchParams.get('next')
    const returnTo = next?.startsWith('/') && !next.startsWith('//') ? next : '/'
    void refresh().then((authenticated) => {
      router.replace(authenticated ? returnTo : '/login?oauth_error=Unable%20to%20start%20your%20session.')
    })
  }, [refresh, router, searchParams])

  return <GoogleLoadingScreen />
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<GoogleLoadingScreen />}>
      <GoogleCallbackContent />
    </Suspense>
  )
}
