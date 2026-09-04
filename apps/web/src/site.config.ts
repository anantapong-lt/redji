const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  }
  return process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
}

export const SITE_CONFIG = {
  type: 'novel' as 'novel' | 'manga',
  name: 'Readji',
  tagline: 'อ่านนิยายออนไลน์ฟรี',
  description: 'แหล่งรวมนิยายออนไลน์และการ์ตูนคุณภาพ อัปเดตทุกวัน',
  apiUrl: getApiUrl(),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  adminUrl: process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3002',
  pageSize: 24,
  coinName: 'เบรี',
} as const

export const isNovelFirst = SITE_CONFIG.type === 'novel'
export const isMangaFirst = SITE_CONFIG.type === 'manga'

export const primaryTypeName = isNovelFirst ? 'นิยาย' : 'การ์ตูน'
