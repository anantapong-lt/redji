import type { NextConfig } from 'next'

function trustedHttpOrigin(value: string | undefined): string | null {
  if (!value || value.startsWith('/')) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null
  } catch {
    // A malformed environment value should not turn into a CSP source.
    return null
  }
}

function trustedPublicMediaUrl(value: string | undefined): URL | null {
  if (!value) return null
  try {
    const url = new URL(value)
    // R2's S3 endpoint, access keys, or a URL carrying credentials must never
    // become a browser allowlist entry. Only a normal HTTPS public media host
    // is appropriate for CSP and next/image.
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return url
  } catch {
    return null
  }
}

const isProduction = process.env.NODE_ENV === 'production'
const apiOrigin = trustedHttpOrigin(process.env.NEXT_PUBLIC_API_URL)
  ?? (isProduction ? null : 'http://localhost:3001')
const publicMediaUrl = trustedPublicMediaUrl(process.env.NEXT_PUBLIC_R2_PUBLIC_URL)
const publicMediaOrigin = publicMediaUrl?.origin
const publicMediaRemotePattern = publicMediaUrl
  ? {
      protocol: 'https' as const,
      hostname: publicMediaUrl.hostname,
      port: publicMediaUrl.port,
      pathname: '/**',
    }
  : null
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `img-src 'self' data: blob: https://images.unsplash.com${publicMediaOrigin ? ` ${publicMediaOrigin}` : ''}`,
  `media-src 'self' blob:${publicMediaOrigin ? ` ${publicMediaOrigin}` : ''}`,
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"}`,
  `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ''}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(isProduction ? ['upgrade-insecure-requests'] : []),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  ...(isProduction
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
]

const nextConfig: NextConfig = {
  // ngrok's public development host is a different origin from localhost.
  // Allow it to load Next.js dev resources during this closed beta.
  allowedDevOrigins: ['unsightly-surrogate-rehab.ngrok-free.dev'],
  // เอาไว้เทสผ่าน ngrok — ถ้าตั้ง NEXT_PUBLIC_API_URL=/api ไว้ (ดู .env.local) เบราว์เซอร์จะยิงมาที่
  // origin เดียวกับตัวเว็บเสมอ แล้ว Next.js proxy ต่อให้ backend เอง (server-to-server ไม่มี
  // CORS/cross-site cookie ให้ต้องแก้) — ไม่กระทบ dev ปกติเพราะไม่มีใครเรียก /api/* ถ้าไม่ตั้ง env ตัวนี้
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/:path*',
      },
    ]
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
  images: {
    remotePatterns: [
      // Unsplash — ใช้ตอน mock data
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      // Public R2/custom-media host from env only. Do not allow every R2
      // bucket: NEXT_PUBLIC_R2_PUBLIC_URL is the exact host returned by API.
      ...(publicMediaRemotePattern ? [publicMediaRemotePattern] : []),
    ],
  },
}

export default nextConfig
