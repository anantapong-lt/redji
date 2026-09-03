'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ProfileHeader } from '@/components/profile/profile-header'
import { ProfileBookshelf } from '@/components/profile/profile-bookshelf'
import { ProfileAboutBox } from '@/components/profile/profile-about-box'
import { ProfileSkeleton } from '@/components/loading/public-page-skeletons'
import { api } from '@/lib/api'
import { useAuthStore, useUser } from '@/store/auth.store'
import type { ProfileData } from '@/types'

export function ProfileClient() {
  const params = useParams<{ uuid: string }>()
  const uuid = params.uuid
  const currentUser = useUser()

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['users', uuid, 'profile'],
    // ⚠️ ไม่ใส่ { public: true } ตรงนี้ — เพราะ apiFetch จะไม่แนบ Authorization header เลยถ้า
    // public: true (ดู lib/api.ts) ทั้งที่ route นี้เป็น optional-auth (ดูได้แบบ guest แต่ถ้ามี
    // token แนบมาด้วย backend จะคำนวณ is_following ของ viewer ปัจจุบันให้) ถ้าใส่ public: true
    // จะทำให้ is_following เป็น false เสมอไม่ว่า viewer จะ follow อยู่จริงหรือไม่ — ไม่มีผลกับ guest
    // เพราะ token เป็น null อยู่แล้ว จะไม่แนบ header เหมือนเดิม
    queryFn: () => api.get<{ data: ProfileData }>(`/users/${uuid}`).then((res) => res.data),
  })

  if (isLoading) {
    return <ProfileSkeleton />
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-[1280px] px-8 py-10">
        <p className="py-16 text-center text-sm text-destructive">ไม่พบผู้ใช้นี้</p>
      </div>
    )
  }

  const isOwnProfile = currentUser?.uuid === uuid

  return (
    <div className="mx-auto max-w-[1280px] px-8 py-10">
      <ProfileHeader
        profile={data}
        isOwnProfile={isOwnProfile}
        onProfileChanged={async () => {
          const { data: fresh } = await refetch()
          if (fresh) useAuthStore.getState().updateUser({ display_name: fresh.display_name, user_img: fresh.user_img })
        }}
      />

      {/* กล่องเก็บนิยาย (3 ส่วน) + กล่องเกี่ยวกับ (1 ส่วน) — สัดส่วน 3:1 ตามที่ user ขอ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <ProfileBookshelf
            uuid={uuid}
            isOwnProfile={isOwnProfile}
            isWriter={data.is_writer}
            initialBookmarksPublic={data.bookmarks_public}
          />
        </div>
        <div className="lg:col-span-1">
          <ProfileAboutBox profile={data} />
        </div>
      </div>
    </div>
  )
}
