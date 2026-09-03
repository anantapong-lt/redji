'use client'

import { useQuery } from '@tanstack/react-query'
import { Megaphone } from 'lucide-react'
import { api } from '@/lib/api'

interface ApiAnnouncementRow {
  id: string
  title: string
  content: string
  color: string
}

// พรีเซ็ตสีที่แอดมินเลือกได้ตอนตั้งประกาศ (ดู announcement-dialog.tsx ฝั่ง apps/admin) —
// จำกัดเป็น preset ไม่ใช่ free-form hex กันเลือกสีที่กลืนพื้นหลัง/อ่านไม่ออกโดยไม่ตั้งใจ
// "gold" คือโทนตามสีรองของเว็บ (--secondary เป็นครีมอ่อนเกินจะใช้เป็นพื้นแถบได้จริง เลยใช้โทนทอง/
// อำพันแทนที่ยังเข้าธีมสีน้ำตาล-ครีมของเว็บ)
const COLOR_GRADIENTS: Record<string, string> = {
  green: 'from-emerald-500 to-green-700',
  red: 'from-red-500 to-rose-700',
  purple: 'from-purple-500 to-violet-700',
  gold: 'from-amber-400 to-yellow-600',
}

// แสดงเฉพาะประกาศล่าสุดที่ status='active' (จัดการเปิด/ปิด/สีผ่านหน้าแอดมิน /admin/announcements
// ที่มีอยู่แล้ว) — ไม่มีประกาศ active ก็ไม่ render อะไรเลย ไม่กินพื้นที่หน้าแรก
export function AnnouncementBar() {
  const { data } = useQuery({
    queryKey: ['announcements', 'active'],
    queryFn: () => api.get<{ data: ApiAnnouncementRow[] }>('/announcements').then((res) => res.data),
  })

  const latest = data?.[0]
  if (!latest) return null

  const gradient = COLOR_GRADIENTS[latest.color] ?? COLOR_GRADIENTS.gold

  return (
    <div className={`w-full bg-gradient-to-r ${gradient} py-2 text-white`}>
      <div className="mx-auto flex max-w-[1440px] items-center gap-2 px-4 text-sm md:px-8">
        <Megaphone className="size-4 shrink-0" />
        <p className="truncate">
          <span className="font-semibold">{latest.title}</span>
          {latest.content && <span className="ml-2 text-white/85">{latest.content}</span>}
        </p>
      </div>
    </div>
  )
}
