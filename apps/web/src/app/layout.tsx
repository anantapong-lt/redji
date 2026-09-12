import type { Metadata } from 'next'
import { AuthProvider } from '@/components/auth/auth-provider'
import { Toaster } from '@/components/ui/sonner'
import { SITE_CONFIG } from '@/site.config'
import { notoSansThai } from '@/lib/fonts'
import './globals.css'

// ─── Metadata ──────────────────────────────────────────────────────────────
// Next.js ใส่ <title> และ <meta> ให้อัตโนมัติ
// metadataBase จำเป็นสำหรับ URL แบบ relative ในหน้าลูก (og:image, canonical ฯลฯ) — ไม่งั้น build error
export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.siteUrl),
  title: {
    default: SITE_CONFIG.name,
    template: `%s | ${SITE_CONFIG.name}`, // หน้าอื่นจะได้ "ชื่อหน้า | Readji"
  },
  description: SITE_CONFIG.description,
  openGraph: {
    title: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    type: 'website',
    images: [
      {
        url: '/icon.png',
        width: 640,
        height: 640,
        alt: `โลโก้ ${SITE_CONFIG.name}`,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_CONFIG.name,
    description: SITE_CONFIG.description,
    images: ['/icon.png'],
  },
}

// ─── Root Layout ───────────────────────────────────────────────────────────
// ไฟล์นี้ wrap ทุกหน้า — เพิ่มอะไรตรงนี้จะมีผลกับทุกหน้าเลย

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${notoSansThai.variable} font-sans antialiased`}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
