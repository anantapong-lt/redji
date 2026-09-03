'use client'

/**
 * app/(main)/profile/page.tsx — โปรไฟล์ของตัวเอง (ต้อง login — ดู proxy.ts USER_EXACT_ROUTES)
 *
 * ดึงจาก GET /users/me (มี email/stats ครบ) ต่างจาก /profile/[uuid] (public) ที่ใช้
 * GET /users/:uuid แทน — ทั้งคู่ map เข้า ProfileData แบบเดียวกันแล้วใช้ ProfileHeader ร่วมกัน
 */

import { useQuery } from '@tanstack/react-query'
import { ProfileHeader } from '@/components/profile/profile-header'
import { ProfileBookshelf } from '@/components/profile/profile-bookshelf'
import { ProfileAboutBox } from '@/components/profile/profile-about-box'
import { ProfileSkeleton } from '@/components/loading/public-page-skeletons'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import type { ProfileData, ProfileStats, SocialLink } from '@/types'

interface ApiMeResponse {
  uuid: string
  u_name: string
  display_name: string
  user_img: string | null
  level: number
  bio: string | null
  social_links: SocialLink[]
  bookmarks_public: boolean
  created_at: string
  stats: ProfileStats
}

export default function OwnProfilePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['users', 'me', 'profile'],
    queryFn: () => api.get<{ user: ApiMeResponse }>('/users/me').then((res) => res.user),
  })

  if (isLoading) {
    return <ProfileSkeleton />
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-[1280px] px-8 py-10">
        <p className="py-16 text-center text-sm text-destructive">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>
      </div>
    )
  }

  const profile: ProfileData = {
    uuid: data.uuid,
    u_name: data.u_name,
    display_name: data.display_name,
    user_img: data.user_img,
    bio: data.bio,
    social_links: data.social_links,
    is_writer: data.level >= 6,
    is_following: false, // ดูโปรไฟล์ตัวเอง — follow ตัวเองไม่ได้อยู่แล้ว
    bookmarks_public: data.bookmarks_public,
    created_at: data.created_at,
    stats: data.stats,
  }

  return (
    <div className="mx-auto max-w-[1280px] px-8 py-10">
      <ProfileHeader
        profile={profile}
        isOwnProfile
        onProfileChanged={async () => {
          const { data: fresh } = await refetch()
          // อัปเดต global auth store ด้วย ให้ navbar/ที่อื่นเห็นชื่อ/รูปใหม่ทันทีไม่ต้อง reload
          if (fresh) useAuthStore.getState().updateUser({ display_name: fresh.display_name, user_img: fresh.user_img })
        }}
      />

      {/* กล่องเก็บนิยาย (3 ส่วน) + กล่องเกี่ยวกับ (1 ส่วน) — สัดส่วน 3:1 ตามที่ user ขอ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <ProfileBookshelf
            uuid={profile.uuid}
            isOwnProfile
            isWriter={profile.is_writer}
            initialBookmarksPublic={profile.bookmarks_public}
          />
        </div>
        <div className="lg:col-span-1">
          <ProfileAboutBox profile={profile} />
        </div>
      </div>
    </div>
  )
}
