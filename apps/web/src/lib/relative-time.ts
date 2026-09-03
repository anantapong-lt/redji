// แปลงเวลาเป็น "อัปเมื่อกี่นาที/ชั่วโมง/วัน/เดือน/ปีที่แล้ว" — ไม่บอกวันที่ตรงๆ
export function relativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const diffSec = Math.floor(diffMs / 1000)

  if (diffSec < 60) return 'เมื่อสักครู่'

  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`

  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} ชั่วโมงที่แล้ว`

  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 30) return `${diffDay} วันที่แล้ว`

  const diffMonth = Math.floor(diffDay / 30)
  if (diffMonth < 12) return `${diffMonth} เดือนที่แล้ว`

  const diffYear = Math.floor(diffMonth / 12)
  return `${diffYear} ปีที่แล้ว`
}
