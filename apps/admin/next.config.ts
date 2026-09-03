import type { NextConfig } from 'next'

function trustedHttpOrigin(value: string | undefined): string | null {
  if (!value || value.startsWith('/')) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null
  } catch {
    return null
  }
}

function trustedPublicMediaUrl(value: string | undefined): URL | null {
  if (!value) return null
  try {
    const url = new URL(value)
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
  // Keep browser traffic same-origin when Admin is exposed through ngrok.
  // The API remains private on this machine; Next.js proxies requests to it.
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
  experimental: {
    // Next.js's rewrites()-based proxy defaults to buffering only the first
    // 10MB of a request body — anything larger gets silently truncated,
    // then the connection resets (ECONNRESET / "socket hang up") once the
    // truncated body doesn't match what the client actually sent. The
    // house-writer bulk-upload dialog's own copy already documents a 500MB
    // limit for multi-chapter novel zips; the proxy default was never
    // raised to match, so any zip over 10MB through admin failed this way.
    proxyClientMaxBodySize: '512mb',
  },
}

export default nextConfig
