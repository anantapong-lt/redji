'use client'

/**
 * app/(writer)/writer/news/page.tsx — "ข่าวสาร" (2026-08-06, ใหม่)
 *
 * ดึงจาก GET /writer/announcements (ห่อ listAnnouncements() เดิมของแอดมิน — ดู
 * writer.routes.ts) โชว์เฉพาะประกาศที่ status='active' — เดิม backend มีฟังก์ชัน CRUD ประกาศ
 * ครบแล้ว (createAnnouncement/updateAnnouncement/deleteAnnouncement) แต่ไม่เคยมีหน้า UI ฝั่งไหน
 * อ่านเลยสักที่ (ทั้งแอดมินสร้าง/นักเขียนอ่าน) — รอบนี้ทำแค่ฝั่งอ่าน (ตามที่ user ขอเฉพาะหน้า
 * writer) ฝั่งแอดมินสร้าง/แก้ไขยังไม่มี UI เลย (log ไว้ใน KNOWN_ISSUES.md)
 */

import { useQuery } from '@tanstack/react-query'
import { Newspaper } from 'lucide-react'
import { api } from '@/lib/api'
import { formatThaiDateTime } from '@/lib/utils'

interface ApiAnnouncement {
  id: string
  title: string
  content: string
  created_at: string
  created_by_name: string
}

export default function WriterNewsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['writer', 'announcements'],
    queryFn: () => api.get<{ data: ApiAnnouncement[] }>('/writer/announcements').then((r) => r.data),
  })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-foreground">ข่าวสาร</h1>

      {isLoading ? (
        <p className="py-16 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : isError ? (
        <p className="py-16 text-center text-sm text-destructive">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง</p>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Newspaper className="size-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">ยังไม่มีข่าวสาร</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {data.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-card p-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-foreground">{a.title}</h2>
                <span className="text-xs text-muted-foreground">โดย {a.created_by_name} · {formatThaiDateTime(a.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-foreground">{a.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
