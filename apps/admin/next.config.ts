import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : 'standalone',
  transpilePackages: ['@readji/shared'],
  async rewrites() {
    const apiHost = process.env.API_INTERNAL_URL || 'http://localhost:4000'
    return [{ source: '/api/:path*', destination: `${apiHost}/:path*` }]
  },
}

export default nextConfig
