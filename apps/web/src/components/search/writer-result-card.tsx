import Image from 'next/image'
import Link from 'next/link'
import { formatCount } from '@/lib/utils'

// การ์ดผลลัพธ์หน้า /search โหมด "นักเขียน" (2026-07-30) — คนละแบบกับ SearchResultCard (การ์ด
// นิยาย) เพราะโหมดนี้ค้นหา "คนเขียน" ไม่ใช่ "เรื่อง" — แนวนอนยาวเต็มความกว้าง (ไม่ใช่กริด 2
// คอลัมน์แบบการ์ดนิยาย) โชว์รูป+ชื่อ+bio ("ข้อมูลเบื้องต้น") + ยอดผู้ติดตาม/ผลงาน (สไตล์กล่อง
// สถิติเดียวกับหัวโปรไฟล์ — profile-header.tsx)
export interface WriterResultData {
  uuid: string
  display_name: string
  user_img: string | null
  bio: string | null
  follower_count: number
  work_count: number
}

export function WriterResultCard({ writer }: { writer: WriterResultData }) {
  return (
    <Link
      href={`/profile/${writer.uuid}`}
      className="flex w-full items-center gap-5 rounded-[25px] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative size-20 shrink-0 overflow-hidden rounded-full bg-primary">
        {writer.user_img ? (
          <Image src={writer.user_img} alt={writer.display_name} fill sizes="80px" className="object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-2xl font-bold text-primary-foreground">
            {writer.display_name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="truncate text-lg font-semibold text-black">{writer.display_name}</h3>
        {writer.bio ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{writer.bio}</p>
        ) : (
          <p className="text-sm text-muted-foreground/60">ยังไม่ได้เขียนแนะนำตัว</p>
        )}
      </div>

      <div className="flex shrink-0 gap-5 rounded-xl border border-[#d9d9d9] px-5 py-3">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xl font-bold text-black">{formatCount(writer.follower_count)}</span>
          <span className="text-xs text-muted-foreground">ผู้ติดตาม</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xl font-bold text-black">{formatCount(writer.work_count)}</span>
          <span className="text-xs text-muted-foreground">ผลงาน</span>
        </div>
      </div>
    </Link>
  )
}
