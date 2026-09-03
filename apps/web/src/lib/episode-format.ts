// รวม "คำเรียกตอน" (migration 014, ค่าต่อตอน เช่น "ตอนที่"/"บทที่" — แต่ละตอนมีของตัวเอง) เข้ากับเลขลำดับตอน
// มีคำเรียกตอน → "ตอนที่ 5"
// ไม่มี (null)  → "5"
export function formatEpisodeOrder(epNo: number, label: string | null | undefined): string {
  const trimmed = label?.trim()
  return trimmed ? `${trimmed} ${epNo}` : `${epNo}`
}

// แสดงชื่อตอนแบบเดียวกันทุกจุด (สารบัญ, dropdown, หน้าอ่าน) — ต่อ formatEpisodeOrder() เข้ากับชื่อตอน
// มีคำเรียกตอน  → "ตอนที่ 5 : ชื่อตอน"
// ไม่มี (null)   → "5 ชื่อตอน" (แบบเดิมก่อนมีฟีเจอร์นี้)
export function formatEpisodeTitle(epNo: number, label: string | null | undefined, epName: string): string {
  const order = formatEpisodeOrder(epNo, label)
  return label?.trim() ? `${order} : ${epName}` : `${order} ${epName}`
}

// เฉพาะหัวข้อหน้าอ่าน (header ตอนอ่าน) — ต่างจาก formatEpisodeTitle ตรงที่ถ้าไม่มีคำเรียกตอน
// จะไม่โชว์เลขลำดับเลย (ตัดทิ้งไปเลย ไม่ใช่แค่ลดความเข้ม) เพราะพื้นที่ header แคบ อยากให้เรียบ
// ที่สุด — เลขลำดับดูจาก breadcrumb/สารบัญ/ปุ่มก่อนหน้า-ถัดไปได้อยู่แล้ว ไม่ต้องซ้ำใน header
// มีคำเรียกตอน → "ตอนที่ 5 : ชื่อตอน" (เหมือน formatEpisodeTitle)
// ไม่มี (null)  → "ชื่อตอน" เฉยๆ
export function formatEpisodeHeaderTitle(epNo: number, label: string | null | undefined, epName: string): string {
  const trimmed = label?.trim()
  return trimmed ? `${trimmed} ${epNo} : ${epName}` : epName
}
