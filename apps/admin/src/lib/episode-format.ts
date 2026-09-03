// พอร์ตมาจาก apps/web/src/lib/episode-format.ts ตรงๆ (2026-08-04)
// รวม "คำเรียกตอน" (ค่าต่อตอน เช่น "ตอนที่"/"บทที่") เข้ากับเลขลำดับตอน
// มีคำเรียกตอน → "ตอนที่ 5"
// ไม่มี (null)  → "5"
export function formatEpisodeOrder(epNo: number, label: string | null | undefined): string {
  const trimmed = label?.trim()
  return trimmed ? `${trimmed} ${epNo}` : `${epNo}`
}

// แสดงชื่อตอนแบบเดียวกันทุกจุด — ต่อ formatEpisodeOrder() เข้ากับชื่อตอน
// มีคำเรียกตอน  → "ตอนที่ 5 : ชื่อตอน"
// ไม่มี (null)   → "5 ชื่อตอน"
export function formatEpisodeTitle(epNo: number, label: string | null | undefined, epName: string): string {
  const order = formatEpisodeOrder(epNo, label)
  return label?.trim() ? `${order} : ${epName}` : `${order} ${epName}`
}
