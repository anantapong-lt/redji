'use client'

/**
 * app/(main)/referral/page.tsx — หน้า "ชวนเพื่อน" (Affiliate, 2026-08-18, ใหม่)
 *
 * โค้ดชวนเพื่อนของแต่ละคน auto-gen จาก u_name ตอนเข้าหน้านี้ครั้งแรก (GET /referral/my-code
 * สร้างให้อัตโนมัติถ้ายังไม่เคยมี) — แลกผ่านปุ่ม "ใช้โค้ด" เดียวกับโค้ดอื่นๆ ทั้งหมด (redeem.service.ts
 * ฝั่ง apps/api) กติกา: คนกรอก (invitee) ได้ 10 เหรียญทันที, เจ้าของโค้ดได้ 1% ของเหรียญที่เพื่อน
 * เติมเงิน "ทุกครั้ง" (ไม่ใช่ครั้งเดียว ไม่มีวันหมดอายุ) จำกัด 10 คนต่อโค้ด
 */

import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Gift, Copy, Link2, Users, Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatThaiDateTime } from '@/lib/utils'

interface MyReferralCode {
  code: string
  percent: number
  signup_bonus_coins: number
  used_count: number
  max_uses: number | null
  total_earned_coins: number
}

interface ReferralFriend {
  id: string
  display_name: string
  u_name: string
  user_img: string | null
  joined_at: string
  earned_coins: number
}

function CodeCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['referral', 'my-code'],
    queryFn: () => api.get<{ data: MyReferralCode }>('/referral/my-code').then((res) => res.data),
  })

  function copyCode() {
    if (!data) return
    navigator.clipboard.writeText(data.code)
    toast.success('คัดลอกโค้ดแล้ว')
  }

  function copyLink() {
    if (!data) return
    navigator.clipboard.writeText(`${window.location.origin}/?ref=${data.code}`)
    toast.success('คัดลอกลิงก์เชิญแล้ว')
  }

  return (
    <section className="rounded-[20px] bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-1 flex items-center gap-2">
        <Gift className="size-5" style={{ color: '#b79240' }} />
        <h2 className="text-lg font-bold text-black">โค้ดชวนเพื่อนของฉัน</h2>
      </div>
      <p className="mb-5 text-xs text-muted-foreground">
        แชร์โค้ดหรือลิงก์นี้ให้เพื่อน — เพื่อนกรอกโค้ดผ่านปุ่ม &quot;ใช้โค้ด&quot; แล้วได้ 10 เหรียญฟรีทันที
        ส่วนคุณจะได้ 1% ของเหรียญที่เพื่อนเติมเงิน{' '}
        <span className="font-semibold text-foreground">ทุกครั้งที่เติม ไม่จำกัดจำนวนครั้ง</span>{' '}
        (จำกัด 10 คนต่อโค้ด)
      </p>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-muted" />
      ) : isError || !data ? (
        <p className="py-6 text-center text-sm text-destructive">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>
      ) : (
        <>
          <div className="mb-4 flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#d9d9d9] bg-muted/30 px-6 py-5 sm:flex-row sm:justify-between">
            <span className="font-mono text-2xl font-bold tracking-widest text-foreground">{data.code}</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={copyCode} className="gap-1.5 rounded-full">
                <Copy className="size-3.5" />
                คัดลอกโค้ด
              </Button>
              <Button type="button" onClick={copyLink} className="gap-1.5 rounded-full">
                <Link2 className="size-3.5" />
                คัดลอกลิงก์เชิญ
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-border/70 px-4 py-3">
              <Users className="size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold text-foreground">
                  {data.used_count}
                  {data.max_uses !== null && <span className="text-sm font-normal text-muted-foreground"> / {data.max_uses}</span>}
                </p>
                <p className="text-xs text-muted-foreground">คนที่ใช้โค้ดแล้ว</p>
              </div>
            </div>
            <div className="flex flex-1 items-center gap-3 rounded-xl border border-border/70 px-4 py-3">
              <Coins className="size-5 shrink-0 text-amber-500" />
              <div>
                <p className="text-lg font-bold text-foreground">{data.total_earned_coins.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">เหรียญที่ได้จากการชวนทั้งหมด</p>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function FriendsList() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['referral', 'my-referrals'],
    queryFn: () => api.get<{ data: ReferralFriend[] }>('/referral/my-referrals').then((res) => res.data),
  })

  const friends = data ?? []

  return (
    <section className="rounded-[20px] bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-1 flex items-center gap-2">
        <Users className="size-5" style={{ color: '#b79240' }} />
        <h2 className="text-lg font-bold text-black">เพื่อนที่ชวนมา</h2>
      </div>
      <p className="mb-5 text-xs text-muted-foreground">รายชื่อเพื่อนที่ใช้โค้ดของคุณ พร้อมเหรียญที่ได้จากแต่ละคน</p>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : isError ? (
        <p className="py-8 text-center text-sm text-destructive">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>
      ) : friends.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">ยังไม่มีเพื่อนใช้โค้ดของคุณเลย — ลองแชร์โค้ดด้านบนดูสิ</p>
      ) : (
        <div className="flex flex-col divide-y divide-border/70">
          {friends.map((f) => (
            <div key={f.id} className="flex items-center gap-3 py-3">
              {f.user_img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.user_img} alt="" className="size-10 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {f.display_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{f.display_name}</p>
                <p className="text-xs text-muted-foreground">เข้าร่วมเมื่อ {formatThaiDateTime(f.joined_at)}</p>
              </div>
              <span className="shrink-0 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                +{f.earned_coins.toLocaleString()} เหรียญ
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function ReferralPage() {
  return (
    <div className="mx-auto max-w-[800px] px-8 py-10">
      <h1 className="mb-6 text-[32px] font-bold text-primary">ชวนเพื่อน</h1>
      <div className="flex flex-col gap-6">
        <CodeCard />
        <FriendsList />
      </div>
    </div>
  )
}
