'use client'

/**
 * components/writer/writer-wallet-card.tsx — การ์ดยอดเงินคงเหลือ + ตัวตนนักเขียน ใน sidebar (2026-08-06, ใหม่)
 *
 * user ส่งภาพอ้างอิงมา: การ์ดเข้มๆ โชว์ "ยอดเงินคงเหลือ" ต่อด้วยแถวรูปโปรไฟล์+ชื่อ+อีเมล (แบบเดียว
 * กับหน้าโปรไฟล์) มีไอคอน chevron คู่ทางขวา — ทั้งแถบคลิกไปหน้าโปรไฟล์ตัวเองได้เลย
 *
 * ยอดเงินคงเหลือดึงจาก GET /writer/dashboard (available_balance) — endpoint นี้เบากว่า
 * /writer/overview/stats มาก (ไม่ query สถิติละเอียดที่ไม่เกี่ยวเลย) เหมาะกับ mount ทุกหน้าใน
 * layout — แก้บั๊กจริงคู่กัน (ดู KNOWN_ISSUES.md): เดิม field นี้ดึงจาก users.point (เหรียญสำหรับ
 * ซื้อตอนอ่าน) ผิดก้อนเงินไปคนละเรื่องกับรายได้นักเขียนเลย ตอนนี้คำนวณจาก sales*rate ถูกต้องแล้ว
 */

import Image from 'next/image'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ChevronsUpDown } from 'lucide-react'
import { api } from '@/lib/api'
import type { User } from '@/types'

interface ApiWriterDashboard {
  available_balance: number
}

function formatBaht(n: number): string {
  return `฿${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function WriterWalletCard({ user }: { user: User }) {
  const { data } = useQuery({
    queryKey: ['writer', 'dashboard'],
    queryFn: () => api.get<{ data: ApiWriterDashboard }>('/writer/dashboard').then((res) => res.data),
  })

  return (
    <div className="flex flex-col gap-2 border-b border-primary-foreground/15 p-3">
      <div className="rounded-xl bg-black/20 px-3.5 py-3">
        <p className="text-xs text-primary-foreground/60">ยอดเงินคงเหลือ</p>
        {/* สีทอง #b79240 — สีเดียวกับที่ใช้เป็น accent เงิน/สถิติทั่วแอป (NovelCard/SearchResultCard/
            RankingBoard) เพื่อความสอดคล้องกัน ไม่ใช่สีที่เดาขึ้นใหม่ */}
        <p className="text-xl font-bold" style={{ color: '#b79240' }}>
          {data ? formatBaht(data.available_balance) : '—'}
        </p>
      </div>

      <Link
        href="/profile"
        className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-primary-foreground/10"
      >
        <div className="relative size-8 shrink-0 overflow-hidden rounded-full bg-primary-foreground/20">
          {user.user_img ? (
            <Image src={user.user_img} alt={user.display_name} fill sizes="32px" className="object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-sm font-bold text-primary-foreground">
              {(user.display_name || user.u_name).charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-primary-foreground">{user.display_name || user.u_name}</p>
          <p className="truncate text-xs text-primary-foreground/60">{user.email}</p>
        </div>
        <ChevronsUpDown className="size-4 shrink-0 text-primary-foreground/50" />
      </Link>
    </div>
  )
}
