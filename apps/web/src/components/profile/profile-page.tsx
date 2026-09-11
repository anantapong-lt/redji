'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react'
import { BookOpenText, Camera, Edit3, Globe2, ImageUp, Link2, Star, UserRound } from 'lucide-react'
import { FaFacebookF, FaInstagram, FaTiktok, FaXTwitter, FaYoutube } from 'react-icons/fa6'
import { useAuth } from '@/components/auth/auth-provider'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getProfile, updateMyProfile, uploadMyProfileCover } from '@/controllers/profile.controller'
import type { ProfileSocialKey, ProfileSocialLinks, UserProfile } from '@/interface/profile.interface'

const SOCIAL_FIELDS: Array<{ key: ProfileSocialKey; label: string; placeholder: string; icon: ComponentType<{ className?: string }> }> = [
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourname', icon: FaFacebookF },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourname', icon: FaInstagram },
  { key: 'x', label: 'X', placeholder: 'https://x.com/yourname', icon: FaXTwitter },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@yourname', icon: FaTiktok },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourname', icon: FaYoutube },
  { key: 'website', label: 'เว็บไซต์', placeholder: 'https://example.com', icon: Globe2 },
]

function ProfileAvatar({ profile, className = 'size-28 text-3xl' }: { profile: UserProfile; className?: string }) {
  const initial = profile.display_name.trim().charAt(0) || profile.username.charAt(0) || '?'
  const avatar = (
    <span className="flex size-full items-center justify-center overflow-hidden rounded-full bg-primary font-bold text-primary-foreground">
      {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="size-full object-cover" /> : initial}
    </span>
  )

  if (profile.role === 'writer') {
    return (
      <span className={`relative flex shrink-0 rounded-full bg-primary p-1 shadow-md ring-4 ring-background ${className}`}>
        {avatar}
      </span>
    )
  }

  return (
    <span className={`flex shrink-0 rounded-full ring-4 ring-background ${className}`}>{avatar}</span>
  )
}

function StoryTile({ story }: { story: UserProfile['stories'][number] }) {
  const label = story.type === 'manga' ? 'มังงะ' : 'นิยาย'
  return (
    <Link href={`/content/${encodeURIComponent(story.slug)}`} className="group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md">
      <div className="relative aspect-[3/4] bg-muted">
        {story.cover_url ? <img src={story.cover_url} alt={`ปก ${story.title}`} className="size-full object-cover transition duration-300 group-hover:scale-105" /> : <BookOpenText className="absolute inset-0 m-auto size-10 text-muted-foreground/50" />}
        <span className="absolute bottom-2 left-2 rounded-full bg-background/90 px-2 py-1 text-[11px] font-semibold text-foreground shadow-sm">{label}</span>
      </div>
      <div className="space-y-1.5 p-3">
        <p className="truncate font-bold group-hover:text-primary">{story.title}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground"><Star className="size-3.5 fill-amber-400 text-amber-400" />{Number(story.rating_average).toFixed(1)} · {story.chapter_count} ตอน</p>
      </div>
    </Link>
  )
}

export function ProfilePage({
  username,
  initialProfile,
}: {
  username?: string
  initialProfile: UserProfile
}) {
  const { accessToken } = useAuth()
  const isOwnProfile = !username
  const [profile, setProfile] = useState<UserProfile>(initialProfile)
  const [editorOpen, setEditorOpen] = useState(false)
  const [coverEditorOpen, setCoverEditorOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [bio, setBio] = useState(initialProfile.bio ?? '')
  const [socialLinks, setSocialLinks] = useState<ProfileSocialLinks>(initialProfile.social_links ?? {})
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [activeStoryType, setActiveStoryType] = useState<'novel' | 'manga'>('novel')
  const [stories, setStories] = useState(initialProfile.stories)
  const [storyPagination, setStoryPagination] = useState(initialProfile.pagination)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const visibleSocials = useMemo(() => SOCIAL_FIELDS.filter(({ key }) => Boolean(profile?.social_links?.[key])), [profile])

  const loadStories = useCallback(async (type: 'novel' | 'manga', page: number, append: boolean) => {
    if (isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const { profile: nextProfile } = await getProfile(profile.username, type, page)
      setStories((current) => append ? [...current, ...nextProfile.stories] : nextProfile.stories)
      setStoryPagination(nextProfile.pagination)
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, profile.username])

  useEffect(() => {
    if (!storyPagination.has_next_page) return
    const onScroll = () => {
      if (window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 360) return
      void loadStories(activeStoryType, storyPagination.page + 1, true)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [activeStoryType, loadStories, storyPagination])

  function changeStoryType(type: 'novel' | 'manga') {
    if (type === activeStoryType) return
    setActiveStoryType(type)
    void loadStories(type, 1, false)
  }

  useEffect(() => () => {
    if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview)
  }, [coverPreview])

  function selectCover(file: File | undefined) {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) return
    if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview)
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
    setCoverEditorOpen(true)
  }

  async function saveProfile() {
    if (!accessToken) return
    setIsSaving(true)
    try {
      const { profile: nextProfile } = await updateMyProfile({ bio, social_links: socialLinks }, accessToken)
      setProfile(nextProfile)
      setEditorOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  async function saveCover() {
    if (!accessToken || !coverFile) return
    setIsSaving(true)
    try {
      const { profile: nextProfile } = await uploadMyProfileCover(coverFile, accessToken)
      setProfile(nextProfile)
      setCoverFile(null)
      setCoverPreview(null)
      setCoverEditorOpen(false)
    } finally {
      setIsSaving(false)
    }
  }

  const collectionTitle = profile.role === 'writer' ? 'ผลงานของนักเขียน' : 'รายการที่ติดตาม'
  const collectionEmpty = profile.role === 'writer' ? 'นักเขียนคนนี้ยังไม่มีผลงานที่เผยแพร่' : 'ยังไม่มีมังงะหรือนิยายที่ติดตามไว้'
  const profileCoverUrl = profile.profile_cover_url ?? '/profile-cover-default.png'

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-8">
      <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
        <div className="relative h-48 overflow-hidden bg-[linear-gradient(120deg,hsl(var(--primary)/.9),hsl(var(--primary)/.45),hsl(var(--secondary)))] sm:h-72">
          <img src={profileCoverUrl} alt="รูปหน้าปกโปรไฟล์" className="size-full object-cover" />
          {isOwnProfile && <Button onClick={() => setCoverEditorOpen(true)} variant="secondary" size="sm" className="absolute right-4 bottom-4 z-20 bg-background/90 shadow-sm backdrop-blur hover:bg-background"><Camera />แก้ไขหน้าปก</Button>}
        </div>
        <div className="relative px-5 pb-6 sm:px-8">
          <div className="-mt-14 flex flex-col gap-4 sm:-mt-16 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <ProfileAvatar profile={profile} className="size-28 text-3xl sm:size-32 sm:text-4xl" />
              <div className="pb-1">
                <h1 className="text-2xl font-extrabold sm:text-3xl">{profile.display_name}</h1>
                <p className="mt-1 text-sm text-muted-foreground">@{profile.username}</p>
              </div>
            </div>
            {isOwnProfile && <Button onClick={() => setEditorOpen(true)} className="w-full sm:mb-1 sm:w-auto"><Edit3 />โปรไฟล์</Button>}
          </div>
          <div className="mt-4 max-w-3xl">
            <p className="mt-4 whitespace-pre-line leading-7 text-foreground/85">{profile.bio || (isOwnProfile ? 'เพิ่มคำแนะนำตัวเพื่อให้ผู้อ่านรู้จักคุณมากขึ้น' : 'ยังไม่ได้เพิ่มคำแนะนำตัว')}</p>
            {visibleSocials.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{visibleSocials.map(({ key, label, icon: Icon }) => <a key={key} href={profile.social_links[key]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium transition hover:border-primary/40 hover:text-primary"><Icon className="size-4" />{label}<Link2 className="size-3" /></a>)}</div>}
          </div>
        </div>
      </section>
      <section className="mt-7"><div className="mb-4 flex flex-wrap items-center gap-3"><BookOpenText className="size-5 text-primary" /><h2 className="text-xl font-extrabold">{collectionTitle}</h2><div className="ml-auto flex rounded-lg bg-muted p-1"><Button type="button" size="sm" variant={activeStoryType === 'novel' ? 'default' : 'ghost'} onClick={() => changeStoryType('novel')}>นิยาย</Button><Button type="button" size="sm" variant={activeStoryType === 'manga' ? 'default' : 'ghost'} onClick={() => changeStoryType('manga')}>การ์ตูน</Button></div></div>
        {stories.length > 0 ? <><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{stories.map((story) => <StoryTile key={story.id} story={story} />)}</div>{isLoadingMore && <p className="mt-6 text-center text-sm text-muted-foreground">กำลังโหลด...</p>}</> : <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground">{collectionEmpty}</div>}
      </section>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>แก้ไขโปรไฟล์</DialogTitle><DialogDescription>แก้ไขแนะนำตัวและช่องทาง Social ของคุณ</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><label className="mb-1.5 block text-sm font-medium">แนะนำตัว</label><Textarea value={bio} maxLength={500} onChange={(event) => setBio(event.target.value)} placeholder="บอกเล่าเรื่องราวเกี่ยวกับตัวคุณ" /><p className="mt-1 text-right text-xs text-muted-foreground">{bio.length}/500</p></div>
            <div className="space-y-3"><p className="text-sm font-medium">ช่องทาง Social</p>{SOCIAL_FIELDS.map(({ key, label, placeholder, icon: Icon }) => <div key={key}><label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon className="size-3.5" />{label}</label><Input type="url" value={socialLinks[key] ?? ''} onChange={(event) => setSocialLinks((current) => ({ ...current, [key]: event.target.value }))} placeholder={placeholder} /></div>)}</div>
          </div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>ยกเลิก</Button><Button type="button" onClick={() => void saveProfile()} disabled={isSaving}>{isSaving ? 'กำลังบันทึก...' : 'บันทึก'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={coverEditorOpen} onOpenChange={setCoverEditorOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>แก้ไขหน้าปก</DialogTitle><DialogDescription>ตรวจสอบรูปที่เลือกก่อนบันทึกหน้าปกใหม่</DialogDescription></DialogHeader>
          <label htmlFor="profile-cover-file" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectCover(event.dataTransfer.files?.[0]) }} className="relative flex aspect-[16/7] w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-primary/60 bg-primary/5 text-center transition hover:border-primary hover:bg-primary/10">
            {coverPreview ? <img src={coverPreview} alt="ตัวอย่างรูปหน้าปก" className="absolute inset-0 size-full object-cover" /> : <><ImageUp className="size-8 text-primary" /><span className="mt-2 font-bold text-primary">ลากรูปหน้าปกมาวางที่นี่</span><span className="mt-1 text-sm text-muted-foreground">หรือคลิกเพื่อเลือกไฟล์</span></>}
            {coverPreview && <span className="relative rounded-lg bg-background/90 px-3 py-2 text-sm font-semibold text-foreground shadow-sm">คลิกเพื่อเลือกรูปใหม่</span>}
            <input id="profile-cover-file" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => selectCover(event.target.files?.[0])} />
          </label>
          <p className="text-xs text-muted-foreground">รองรับ JPG, PNG และ WebP ขนาดไม่เกิน 5 MB</p>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setCoverEditorOpen(false)}>ยกเลิก</Button><Button type="button" onClick={() => void saveCover()} disabled={isSaving || !coverFile}>{isSaving ? 'กำลังบันทึก...' : 'บันทึกหน้าปก'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
