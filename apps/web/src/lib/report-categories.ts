// lib/report-categories.ts — หมวดหมู่รายงานเนื้อหา (dropdown ใน ReportDialog)
//
// รายการเดียวกับ apps/api/src/lib/report-categories.ts เป๊ะ — 2 แอปนี้เป็นคนละ TS project แชร์
// import ตรงๆ ไม่ได้ ถ้าจะเพิ่ม/แก้หมวดหมู่ ต้องแก้ทั้ง 2 ที่ให้ตรงกัน
//
// หมวด "content_error" (รายงานความผิดพลาด) เด้งเข้าคิวนักเขียนเจ้าของผลงานแทนคิวแอดมิน — ที่เหลือ
// ทั้งหมดเข้าคิวแอดมินเหมือนเดิม (ดู routedTo)

export type ReportCategory =
  | 'content_error'
  | 'copyright'
  | 'unrated_18plus'
  | 'inappropriate'
  | 'scam'
  | 'spam'
  | 'impersonation'
  | 'harassment'
  | 'general'
  | 'other'

export interface ReportCategoryInfo {
  code: ReportCategory
  label: string
  routedTo: 'writer' | 'admin'
}

export const REPORT_CATEGORIES: ReportCategoryInfo[] = [
  { code: 'content_error', label: 'รายงานความผิดพลาด (สะกดผิด, เขียนผิด, แท็กผิด)', routedTo: 'writer' },
  { code: 'copyright', label: 'ละเมิดลิขสิทธิ์ / คัดลอกผลงาน', routedTo: 'admin' },
  { code: 'unrated_18plus', label: 'มีเนื้อหา 18+ แต่ไม่ติดเรท', routedTo: 'admin' },
  { code: 'inappropriate', label: 'เนื้อหาไม่เหมาะสม / ผิดกฎ', routedTo: 'admin' },
  { code: 'scam', label: 'หลอกลวง / ลิงก์อันตราย', routedTo: 'admin' },
  { code: 'spam', label: 'สแปม / โฆษณา', routedTo: 'admin' },
  { code: 'impersonation', label: 'แอบอ้างผู้อื่น', routedTo: 'admin' },
  { code: 'harassment', label: 'คุกคาม / กลั่นแกล้ง', routedTo: 'admin' },
  { code: 'general', label: 'ปัญหาทั่วไป', routedTo: 'admin' },
  { code: 'other', label: 'อื่นๆ', routedTo: 'admin' },
]

const CATEGORY_MAP = new Map(REPORT_CATEGORIES.map((c) => [c.code, c]))

export function getReportCategoryLabel(code: string): string {
  return CATEGORY_MAP.get(code as ReportCategory)?.label ?? code
}
