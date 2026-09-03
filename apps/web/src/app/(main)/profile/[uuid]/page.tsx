import type { Metadata } from 'next'
import { SITE_CONFIG } from '@/site.config'
import { ProfileClient } from './profile-client'

/**
 * app/(main)/profile/[uuid]/page.tsx — โปรไฟล์สาธารณะของ user คนไหนก็ได้ (ดูได้โดยไม่ต้อง
 * login — ดู proxy.ts ที่ตั้งใจไม่รวม path นี้ไว้ใน USER_EXACT_ROUTES)
 *
 * generateMetadata ต้องอยู่ใน Server Component เท่านั้น — ย้าย client logic เดิมทั้งหมดไป
 * profile-client.tsx แล้ว (ดู page.tsx ของ /works/[uuid] สำหรับเหตุผลเต็มเรื่อง SEO)
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ uuid: string }>
}): Promise<Metadata> {
  const { uuid } = await params

  try {
    const res = await fetch(`${SITE_CONFIG.apiUrl}/users/${uuid}`)
    if (!res.ok) throw new Error('not found')
    const { data: profile } = await res.json()

    const title = profile.display_name as string
    const description = (profile.bio as string | null) ?? SITE_CONFIG.description
    const image = profile.user_img as string | null

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'profile',
        images: image ? [{ url: image }] : undefined,
      },
      twitter: {
        card: 'summary',
        title,
        description,
        images: image ? [image] : undefined,
      },
      alternates: {
        canonical: `/profile/${uuid}`,
      },
    }
  } catch {
    return {}
  }
}

export default function PublicProfilePage() {
  return <ProfileClient />
}
