import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : 'standalone',
  transpilePackages: ['@readji/shared'],
}

export default nextConfig
