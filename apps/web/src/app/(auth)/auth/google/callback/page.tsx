'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth/auth-provider'

export default function GoogleCallbackPage() {
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

  return <p className="text-center text-sm text-muted-foreground">กำลังเข้าสู่ระบบด้วย Google...</p>
}
