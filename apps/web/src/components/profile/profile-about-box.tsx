import { SocialIcon } from './social-icon'
import type { ProfileData } from '@/types'

// กล่อง "เกี่ยวกับ" — แนะนำตัว + ช่องทางโซเชียล ย้ายมาจากหัวโปรไฟล์เดิม (2026-07-28 user ขอ
// แยกเป็นกล่องขวาสัดส่วน 1 ส่วน คู่กับกล่องเก็บนิยาย 3 ส่วน — ดู profile-bookshelf.tsx)
export function ProfileAboutBox({ profile }: { profile: ProfileData }) {
  const hasContent = profile.bio || profile.social_links.length > 0

  return (
    <div className="flex flex-col gap-4 rounded-[25px] bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-black">เกี่ยวกับ</h2>

      {!hasContent && <p className="text-sm text-muted-foreground">ยังไม่มีข้อมูลแนะนำตัว</p>}

      {profile.bio && <p className="text-sm whitespace-pre-wrap text-black">{profile.bio}</p>}

      {profile.social_links.length > 0 && (
        <div className="flex flex-col gap-2">
          {profile.social_links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <SocialIcon url={link.url} className="size-4 shrink-0" />
              <span className="truncate">{link.label || link.url.replace(/^https?:\/\//, '')}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
