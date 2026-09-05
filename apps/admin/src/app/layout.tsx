import type { Metadata } from 'next'
import { Noto_Sans_Thai } from 'next/font/google'
import { AdminAuthProvider } from '@/components/admin-auth-provider'
import { AdminShell } from '@/components/admin-shell'
import './globals.css'

const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Readji Admin',
  description: 'Readji control center',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className={notoSansThai.variable}>
        <AdminAuthProvider>
          <AdminShell>{children}</AdminShell>
        </AdminAuthProvider>
      </body>
    </html>
  )
}
