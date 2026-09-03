import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 12500 -> "12.50k", 999 -> "999" */
export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k`
  return String(n)
}

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
]

/** พ.ศ. + เวลา แบบ "12 ก.ค. 2569, 07:36 น." */
export function formatThaiDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getDate()
  const month = THAI_MONTHS[d.getMonth()]
  const yearBE = d.getFullYear() + 543
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${day} ${month} ${yearBE}, ${hh}:${mm} น.`
}

const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

/** วันที่เข้าร่วม แบบ "กรกฎาคม 2026" (เดือนเต็ม + ปี ค.ศ. ตรงกับที่หน้าโปรไฟล์ใช้ ไม่ใช่ พ.ศ.) */
export function formatJoinDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${THAI_MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`
}

/** เวลาถอยหลังแบบ "5 นาที ที่ผ่านมา" / "2 ชม. ที่ผ่านมา" / "3 วัน ที่ผ่านมา" — ใช้ในหน้า Feed
 *  (การ์ด "อ่านล่าสุด"/"เรื่องที่กดดาว") เกิน 30 วันแล้วโชว์เป็นวันที่เต็มแทน (ไม่มีประโยชน์บอก
 *  เป็นจำนวนวันเยอะๆ) */
export function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diffMs / (60 * 1000))
  const hours = Math.floor(diffMs / (60 * 60 * 1000))
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000))

  if (minutes < 1) return 'เมื่อสักครู่'
  if (minutes < 60) return `${minutes} นาที ที่ผ่านมา`
  if (hours < 24) return `${hours} ชม. ที่ผ่านมา`
  if (days < 30) return `${days} วัน ที่ผ่านมา`
  return formatThaiDateTime(dateStr)
}
