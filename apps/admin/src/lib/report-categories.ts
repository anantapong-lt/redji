// lib/report-categories.ts — หมวดหมู่รายงานเนื้อหา ใช้แปล category code → label แสดงในคิวรายงาน
// รายการเดียวกับ apps/api/src/lib/report-categories.ts เป๊ะ — 2 แอปนี้เป็นคนละ TS project แชร์
// import ตรงๆ ไม่ได้ ถ้าจะเพิ่ม/แก้หมวดหมู่ ต้องแก้ทั้ง 2 ที่ให้ตรงกัน

const CATEGORY_LABELS: Record<string, string> = {
  content_error: 'รายงานความผิดพลาด (สะกดผิด, เขียนผิด, แท็กผิด)',
  copyright: 'ละเมิดลิขสิทธิ์ / คัดลอกผลงาน',
  unrated_18plus: 'มีเนื้อหา 18+ แต่ไม่ติดเรท',
  inappropriate: 'เนื้อหาไม่เหมาะสม / ผิดกฎ',
  scam: 'หลอกลวง / ลิงก์อันตราย',
  spam: 'สแปม / โฆษณา',
  impersonation: 'แอบอ้างผู้อื่น',
  harassment: 'คุกคาม / กลั่นแกล้ง',
  general: 'ปัญหาทั่วไป',
  other: 'อื่นๆ',
}

export function getReportCategoryLabel(code: string | null): string {
  if (!code) return 'ไม่ระบุหมวดหมู่ (รายงานเก่า)'
  return CATEGORY_LABELS[code] ?? code
}
