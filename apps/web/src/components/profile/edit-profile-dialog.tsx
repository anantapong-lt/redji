'use client'

/**
 * EditProfileDialog — โครงอ้างอิงจาก screenshot ที่ user ส่งมา (หน้าตั้งค่าโปรไฟล์ของเว็บอื่น)
 * ปรับ helper text ขนาดรูป "256×256" ในต้นฉบับ → "512×512" ให้ตรงกับ preset จริงของระบบนี้
 * (IMAGE_PRESETS.profile ใน apps/api/src/lib/image.ts) ไม่ใช่ก็อปตัวเลขที่ไม่ตรงกับของจริง
 *
 * เลือกรูปโปรไฟล์ → เปิด dialog ครอบตัด/ซูมก่อน (AvatarCropDialog) แล้วค่อยอัปโหลดรูปที่ตัด
 * แล้วทันที (endpoint แยกจากฟิลด์อื่น) — ชื่อ/แนะนำตัว/ช่องทางโซเชียล (สูงสุด 4 อัน แบบ
 * YouTube Studio) รวมกันเป็นการ save เดียวตอนกด "บันทึกการเปลี่ยนแปลง"
 */

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, User, PenLine, Plus, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SocialIcon } from './social-icon'
import { AvatarCropDialog } from './avatar-crop-dialog'
import { api } from '@/lib/api'
import type { ProfileData } from '@/types'

const MAX_SOCIAL_LINKS = 4

interface LinkRow {
  url: string
  label: string
}

export function EditProfileDialog({
  open,
  onOpenChange,
  profile,
  onProfileChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: ProfileData
  onProfileChanged: () => void
}) {
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [bio, setBio] = useState(profile.bio ?? '')
  const [links, setLinks] = useState<LinkRow[]>(
    profile.social_links.map((l) => ({ url: l.url, label: l.label ?? '' })),
  )
  const [avatarPreview, setAvatarPreview] = useState(profile.user_img)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropOpen, setCropOpen] = useState(false)

  // ตั้งค่าเริ่มต้นแค่ตอน "เปิด" หน้าต่างเท่านั้น (dep แค่ open ไม่ใช่ profile) — ถ้าใส่ profile
  // เข้าไปด้วยจะ reset ทุกช่องที่กำลังแก้อยู่ทุกครั้งที่ profile เปลี่ยน (เช่นตอนอัปโหลด/ลบรูป
  // เรียก onProfileChanged() ทำให้ parent refetch แล้ว profile object เปลี่ยน object reference
  // ทั้งที่ dialog ยังเปิดอยู่ ผู้ใช้กำลังกรอกช่องทางโซเชียล/แนะนำตัวค้างอยู่จะโดนลบทิ้งเงียบๆ)
  useEffect(() => {
    if (open) {
      setDisplayName(profile.display_name)
      setBio(profile.bio ?? '')
      setLinks(profile.social_links.map((l) => ({ url: l.url, label: l.label ?? '' })))
      setAvatarPreview(profile.user_img)
      setError('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
    setCropOpen(true)
    // เคลียร์ input ทันที กันเลือกไฟล์เดิมซ้ำแล้ว onChange ไม่ยิง (browser ไม่ยิง change ถ้า
    // ไฟล์เดิมเป๊ะ) ไม่กระทบ cropSrc ที่เก็บ object URL ไว้แยกแล้ว
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleCropped(blob: Blob) {
    setAvatarBusy(true)
    try {
      const form = new FormData()
      form.append('avatar', blob, 'avatar.jpg')
      const result = await api.post<{ data: { user_img: string } }>('/users/me/avatar', form).then((res) => res.data)
      setAvatarPreview(result.user_img)
      onProfileChanged()
    } catch (err: any) {
    } finally {
      setAvatarBusy(false)
    }
  }

  async function handleRemoveAvatar() {
    setAvatarBusy(true)
    try {
      await api.delete('/users/me/avatar')
      setAvatarPreview(null)
      onProfileChanged()
    } catch (err: any) {
    } finally {
      setAvatarBusy(false)
    }
  }

  // ใช้ functional setState form (prev => ...) ทุกจุด กัน stale closure ตอน state update
  // หลายครั้งติดกันก่อน re-render (เช่น กด "เพิ่มช่องทาง" รัวๆ)
  function addLink() {
    setLinks((prev) => (prev.length >= MAX_SOCIAL_LINKS ? prev : [...prev, { url: '', label: '' }]))
  }

  function removeLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index))
  }

  function updateLink(index: number, field: keyof LinkRow, value: string) {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)))
  }

  async function handleSubmit() {
    const trimmedName = displayName.trim()
    if (!trimmedName) {
      setError('กรุณากรอกชื่อที่แสดง')
      return
    }

    const validLinks = links
      .filter((l) => l.url.trim())
      .map((l) => ({ url: l.url.trim(), label: l.label.trim() || null }))

    setSaving(true)
    try {
      await Promise.all([
        api.patch('/users/me', {
          display_name: trimmedName,
          bio: bio.trim() || null,
        }),
        api.put('/users/me/social-links', { links: validLinks }),
      ])
      onProfileChanged()
      onOpenChange(false)
    } catch (err: any) {
      const message = err?.message ?? 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>ข้อมูลส่วนตัว</DialogTitle>
          </DialogHeader>
          <p className="-mt-3 text-xs text-muted-foreground">ข้อมูลเหล่านี้จะแสดงในหน้าโปรไฟล์สาธารณะของคุณ</p>

          <div className="flex flex-col gap-5">
            <div>
              <label className="mb-2 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Camera className="size-4" />
                รูปโปรไฟล์
              </label>
              <div className="flex items-center gap-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-full bg-primary">
                  {avatarPreview ? (
                    <Image src={avatarPreview} alt="รูปโปรไฟล์" fill sizes="64px" className="object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-xl font-bold text-primary-foreground">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAvatarSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={avatarBusy}
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-full"
                  >
                    {avatarBusy ? 'กำลังอัปโหลด...' : 'เลือกรูปภาพ'}
                  </Button>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={avatarBusy}
                      className="flex cursor-pointer items-center gap-1 text-xs font-medium text-destructive hover:underline disabled:opacity-50"
                    >
                      <X className="size-3" />
                      ลบรูปภาพ
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">เลือกรูปแล้วจัดวาง/ซูมก่อนอัปโหลดได้ — ปรับขนาดสุดท้ายเป็น 512×512 พิกเซล</p>
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <User className="size-4" />
                ชื่อที่แสดง
                {profile.u_name && (
                  <span className="font-normal text-muted-foreground/50">ID: {profile.u_name}</span>
                )}
              </label>
              <input
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value)
                  setError('')
                }}
                maxLength={50}
                className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <p className="mt-1 text-xs text-muted-foreground">ชื่อที่จะแสดงในโปรไฟล์และความคิดเห็นของคุณ</p>
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <PenLine className="size-4" />
                แนะนำตัว
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, 500))}
                maxLength={500}
                rows={3}
                placeholder="เล่าเกี่ยวกับตัวคุณ..."
                className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">{bio.length}/500 ตัวอักษร</p>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  ช่องทาง / เว็บไซต์
                </label>
                <span className="text-xs text-muted-foreground">{links.length}/{MAX_SOCIAL_LINKS}</span>
              </div>

              <div className="flex flex-col gap-2">
                {links.map((link, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-input text-muted-foreground">
                      <SocialIcon url={link.url} className="size-4" />
                    </span>
                    <input
                      value={link.url}
                      onChange={(e) => updateLink(i, 'url', e.target.value)}
                      maxLength={300}
                      placeholder="https://example.com"
                      className="h-9 min-w-0 flex-[2] rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    <input
                      value={link.label}
                      onChange={(e) => updateLink(i, 'label', e.target.value)}
                      maxLength={30}
                      placeholder="คำเรียก เช่น YouTube"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                    <button
                      type="button"
                      onClick={() => removeLink(i)}
                      aria-label="ลบช่องทางนี้"
                      className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>

              {links.length < MAX_SOCIAL_LINKS && (
                <button
                  type="button"
                  onClick={addLink}
                  className="mt-2 flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-[#d9d9d9] px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  <Plus className="size-3.5" />
                  เพิ่มช่องทาง
                </button>
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">
                ระบบเดา YouTube/Facebook/Instagram/TikTok/X จากลิงก์ให้อัตโนมัติ — ช่องคำเรียกไว้ตั้งชื่อย่อเอง (เว้นว่างได้)
              </p>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-center gap-3">
            <Button type="button" variant="destructive" onClick={() => onOpenChange(false)} disabled={saving} className="rounded-full px-6">
              ยกเลิก
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={saving} className="rounded-full px-6">
              {saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AvatarCropDialog imageSrc={cropSrc} open={cropOpen} onOpenChange={setCropOpen} onCropped={handleCropped} />
    </>
  )
}
