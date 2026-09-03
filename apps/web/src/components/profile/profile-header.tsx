'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  BookOpen,
  Star,
  Heart,
  MessageCircle,
  CalendarDays,
  Settings2,
  ShieldCheck,
  EllipsisVertical,
  Share2,
  Flag,
  UserPlus,
  UserCheck,
  PenLine,
} from 'lucide-react'
import { cn, formatJoinDate } from '@/lib/utils'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EditProfileDialog } from './edit-profile-dialog'
import { ReportDialog } from '@/components/works/report-dialog'
import type { ProfileData } from '@/types'


// หัวโปรไฟล์ — ใช้ทั้งหน้าโปรไฟล์ตัวเอง (/profile) และคนอื่น (/profile/[uuid])
// อ้างอิงโครงจาก Tofu Novel (คู่แข่ง user ส่งมาให้ดู) แต่ปรับสไตล์/สีให้เข้ากับ Readji เอง
// (พาเล็ตต์ #d0c6b0/#b79240 ที่ใช้อยู่แล้วทั้งแอป ไม่ใช่ก็อปสีของเขาตรงๆ)
export function ProfileHeader({
  profile,
  isOwnProfile,
  onProfileChanged,
}: {
  profile: ProfileData
  isOwnProfile: boolean
  onProfileChanged?: () => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const token = useAuthStore((s) => s.token)
  const router = useRouter()
  const queryClient = useQueryClient()

  // ปุ่มติดตาม — เริ่มจากค่าที่ backend คำนวณมาให้แล้ว (is_following ดูจาก user_followers
  // เทียบกับ viewer ปัจจุบัน) ใช้ pattern optimistic update + revert เดียวกับ toggleBookmark
  // ใน novel-hero-section.tsx (follow ได้ทั้งนักเขียนและนักอ่านทั่วไป ไม่จำกัด level)
  const [isFollowing, setIsFollowing] = useState(profile.is_following)
  const [followerCount, setFollowerCount] = useState(profile.stats.follower_count ?? 0)

  // sync กลับเข้า cache ของ query ['users', uuid, 'profile'] (หน้า /profile/[uuid] เท่านั้น —
  // ปุ่มติดตามไม่โชว์บนโปรไฟล์ตัวเองอยู่แล้ว เลยมีคีย์เดียวที่ต้องแตะ) เดิม toggle นี้อัปเดตแค่
  // useState ในตัว component ไม่เคยแตะ cache เลย พอสลับหน้าไปมาแล้วกลับมาภายใน staleTime (60 วิ,
  // providers.tsx) จะเห็นค่าเก่า (ยังไม่ follow) ย้อนกลับมาทับ ทั้งที่ backend บันทึกถูกต้องแล้ว
  function patchProfileCache(patch: { is_following?: boolean; follower_count?: number }) {
    queryClient.setQueryData<ProfileData>(['users', profile.uuid, 'profile'], (old) =>
      old
        ? {
            ...old,
            ...(patch.is_following !== undefined ? { is_following: patch.is_following } : {}),
            ...(patch.follower_count !== undefined ? { stats: { ...old.stats, follower_count: patch.follower_count } } : {}),
          }
        : old,
    )
  }

  async function toggleFollow() {
    if (!token) {
      router.push('/login')
      return
    }
    const wasFollowing = isFollowing
    const nextCount = followerCount + (wasFollowing ? -1 : 1)
    setIsFollowing(!wasFollowing)
    setFollowerCount(nextCount)
    patchProfileCache({ is_following: !wasFollowing, follower_count: nextCount })
    try {
      if (wasFollowing) {
        await api.delete(`/social/follow/${profile.uuid}`)
      } else {
        await api.post(`/social/follow/${profile.uuid}`)
      }
    } catch (err: any) {
      setIsFollowing(wasFollowing)
      setFollowerCount(followerCount)
      patchProfileCache({ is_following: wasFollowing, follower_count: followerCount })
    }
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href)
    toast.success('คัดลอกลิงก์แล้ว')
  }

  function handleReport() {
    setReportOpen(true)
  }

  // ?? 0 กันเผื่อ field หายไปจาก response (เช่น cache เก่าก่อนหน้าที่ backend เพิ่ง field ใหม่มา)
  // ไม่งั้น React render undefined เป็นช่องว่างเปล่าๆ แทนที่จะเป็น "0"
  // 2026-07-29: ความหมายของเลข 4 อันนี้ต่างกันตาม role (ตัวเลขจริงคำนวณฝั่ง backend แล้ว —
  // getProfileStats() ใน user.service.ts) — นักอ่านทั่วไป = ค่าที่ตัวเองทำ (อ่าน/เก็บ/กดใจ/
  // คอมเม้นไปกี่ครั้ง) นักเขียน = ค่ารวมที่ได้รับจากผลงานตัวเอง (คนอื่นอ่าน/เก็บ/กดใจ/คอมเม้น
  // ผลงานเรารวมกี่ครั้ง) ไอคอนปากกาด้านล่างกล่องช่วยสื่อความหมายนี้ให้ชัดตอนเป็นนักเขียน
  const stats: { icon: typeof BookOpen; label: string; value: number }[] = [
    { icon: BookOpen, label: 'อ่านแล้ว', value: profile.stats.read_count ?? 0 },
    { icon: Star, label: 'เรื่องที่ติดตาม', value: profile.stats.bookmark_count ?? 0 },
    { icon: Heart, label: 'หัวใจ', value: profile.stats.favorite_count ?? 0 },
    { icon: MessageCircle, label: 'ความคิดเห็น', value: profile.stats.comment_count ?? 0 },
  ]
  const followingCount = profile.stats.following_count ?? 0

  return (
    <div className="relative mb-8 flex flex-col gap-6 rounded-[25px] bg-white p-6 shadow-sm sm:flex-row sm:items-start sm:p-8">
      {/* กรอบขาวแบบ banner ห่อหุ้มทั้ง section — ทำไม? สีทอง/แดงเข้มของธีม (avatar/badge/ไอคอน
          สถิติ) ไม่มีพื้นที่ขาวคั่นเลยตอนวางตรงบนพื้นหลังของหน้า (ออกทางครีม/ทองอ่อนอยู่แล้ว)
          ทำให้ดูกลืนเป็นสีทองไปหมด — ใส่กรอบขาวให้ตัดกันชัดเจน เหมือน card ขาวที่ใช้ทั้งแอป
          (SearchResultCard/RankingBoard) ไม่ใช่แค่ border-bottom บางๆ แบบเดิม */}
      {/* Kebab (แชร์/รายงาน) มุมขวาบน — pattern เดียวกับ novel-hero-section.tsx เปิด ReportDialog
          ตัวเดียวกับที่ใช้รายงาน comment/work (targetType='user', 2026-08-18 ต่อ backend จริงแล้ว)
          รายงานตัวเองไม่ได้เลยซ่อนตัวเลือกนั้นถ้าเป็นโปรไฟล์ตัวเอง แต่แชร์โปรไฟล์ตัวเองได้ปกติ */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="ตัวเลือกเพิ่มเติม"
            className="absolute top-4 right-4 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-[#d9d9d9] text-muted-foreground hover:bg-muted sm:top-6 sm:right-6"
          >
            <EllipsisVertical className="size-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-44 gap-1 p-1.5">
          <button
            type="button"
            onClick={handleShare}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted"
          >
            <Share2 className="size-4" />
            แชร์
          </button>
          {!isOwnProfile && (
            <button
              type="button"
              onClick={handleReport}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-sm text-destructive hover:bg-muted"
            >
              <Flag className="size-4" />
              รายงาน
            </button>
          )}
        </PopoverContent>
      </Popover>

      <div className="relative size-24 shrink-0 overflow-hidden rounded-full bg-primary sm:size-28">
        {profile.user_img ? (
          <Image src={profile.user_img} alt={profile.display_name} fill sizes="112px" className="object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-3xl font-bold text-primary-foreground">
            {profile.display_name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2.5 sm:pr-14">
          <h1 className="truncate text-2xl font-bold text-black">{profile.display_name}</h1>

          {profile.is_writer && (
            <span className="shrink-0 rounded-full bg-[#d0c6b0] px-3 py-1 text-xs font-semibold text-primary">
              นักเขียน
            </span>
          )}

          {isOwnProfile && (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-[#d9d9d9] px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <Settings2 className="size-3.5" />
              แก้ไข
            </button>
          )}

          {/* ปุ่ม "ตั้งค่า" — แยกจาก "แก้ไข" (ข้อมูลสาธารณะ: รูป/ชื่อ/bio/โซเชียล) เพราะเป็นเรื่อง
              ความปลอดภัยบัญชี (เปลี่ยนรหัสผ่าน + ดูประวัติการเข้าสู่ระบบ) ไปหน้าแยก /settings แทนที่
              จะเปิด dialog เพราะเนื้อหายาวกว่าและมีสองส่วนแยกกันชัดเจน */}
          {isOwnProfile && (
            <button
              type="button"
              onClick={() => router.push('/settings')}
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-[#d9d9d9] px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <ShieldCheck className="size-3.5" />
              ตั้งค่า
            </button>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="size-4" />
          เข้าร่วม {formatJoinDate(profile.created_at)}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-4">
          {/* ผู้ติดตาม/กำลังติดตาม — ใหญ่กว่ากล่องสถิติ 4 อันด้านขวา ตามที่ user ขอ อยู่ซ้ายมือ */}
          <div className="flex gap-6 self-stretch rounded-xl border border-[#d9d9d9] bg-white px-5 py-3">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xl font-bold text-black">{followerCount}</span>
              <span className="text-xs text-muted-foreground">ผู้ติดตาม</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xl font-bold text-black">{followingCount}</span>
              <span className="text-xs text-muted-foreground">กำลังติดตาม</span>
            </div>
          </div>

          {/* พื้นหลังไล่สีเงินอ่อนๆ (แยกจากกล่องผู้ติดตามซ้ายมือที่เป็นขาวธรรมดา) ตามที่ user ขอ
              — ไอคอนปากกาด้านล่างโชว์เฉพาะนักเขียน สื่อว่าตัวเลขเหล่านี้เป็นค่ารวมจากผลงาน ไม่ใช่
              ค่าส่วนตัว — จัดเนื้อหาให้อยู่กึ่งกลางแนวตั้งเสมอ (justify-center) กันดูเหมือนลอยค้าง
              ด้านบนตอนกล่องนี้ถูกยืดสูงเท่ากล่องผู้ติดตาม (self-stretch) */}
          <div className="flex flex-col items-center justify-center gap-1.5 self-stretch rounded-xl border border-slate-300/60 bg-gradient-to-br from-slate-50 via-white to-slate-200 px-4 py-2">
            <div className="flex gap-4">
              {stats.map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-1 text-sm font-bold text-black">
                    <s.icon className="size-3.5" style={{ color: '#b79240' }} />
                    {s.value}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
            {profile.is_writer && (
              <span title="สถิติรวมจากผลงานทั้งหมด">
                <PenLine className="size-3.5 text-slate-400" />
              </span>
            )}
          </div>

          {/* ปุ่มติดตาม — อยู่แถวเดียวกับกล่องสถิติ ดันไปชิดขวาสุดด้วย ml-auto (แทนที่จะลอย
              absolute แยกจาก flex เดิม เพราะทำให้การ์ดต้องเผื่อพื้นที่ว่างข้างล่างเกินจำเป็น
              ดูเป็นช่องว่างที่ไม่มีความหมายเวลาการ์ดไม่ได้สูงเท่ากับที่เผื่อไว้พอดี) — เฉพาะดูโปรไฟล์
              คนอื่นเท่านั้น (follow ตัวเองไม่ได้) */}
          {!isOwnProfile && (
            <button
              type="button"
              onClick={toggleFollow}
              className={cn(
                'ml-auto flex cursor-pointer items-center gap-1.5 self-center rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                isFollowing
                  ? 'border-[#d9d9d9] bg-white text-muted-foreground hover:bg-muted'
                  : 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              {isFollowing ? <UserCheck className="size-4" /> : <UserPlus className="size-4" />}
              {isFollowing ? 'กำลังติดตาม' : 'ติดตาม'}
            </button>
          )}
        </div>
      </div>

      {isOwnProfile && onProfileChanged && (
        <EditProfileDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          profile={profile}
          onProfileChanged={onProfileChanged}
        />
      )}

      {!isOwnProfile && (
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          targetType="user"
          targetRef={profile.uuid}
          title={`รายงาน ${profile.display_name}`}
        />
      )}
    </div>
  )
}
