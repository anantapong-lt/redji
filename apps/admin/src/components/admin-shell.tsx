'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import { useAdminAuth } from '@/components/admin-auth-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { status } = useAdminAuth()
  const isLoginPage = pathname === '/login'

  useEffect(() => {
    if (status === 'loading') return

    if (isLoginPage && status === 'authenticated') {
      router.replace('/site')
    } else if (!isLoginPage && status === 'unauthenticated') {
      router.replace('/login')
    }
  }, [isLoginPage, router, status])

  if (isLoginPage) return children

  if (status !== 'authenticated') {
    return <main className="admin-auth-loading" aria-busy="true">กำลังตรวจสอบสิทธิ์...</main>
  }

  return (
    <SidebarProvider>
      <Sidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  )
}
