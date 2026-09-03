// =============================================================
// Novel Platform — หมวดหมู่รายงานเนื้อหา (content_reports, migration 032)
// วางไว้ที่: apps/api/src/lib/report-categories.ts
// =============================================================
//
// ก่อนหน้านี้ content_reports ไม่มีหมวดหมู่เลย (แค่ reason ข้อความเปล่า) — user ขอเพิ่ม dropdown
// หมวดหมู่ โดยมีอยู่หมวดเดียว ("content_error") ที่ routedTo:'writer' (เด้งเข้าคิว "รายงานที่
// ได้รับ" ของนักเขียนเจ้าของผลงานแทนคิวแอดมิน) ที่เหลือทั้งหมด routedTo:'admin' เหมือนเดิม
//
// รายการเดียวกับ apps/web/src/lib/report-categories.ts เป๊ะ — 2 แอปนี้เป็นคนละ TS project
// แชร์ import ตรงๆ ไม่ได้ ถ้าจะเพิ่ม/แก้หมวดหมู่ ต้องแก้ทั้ง 2 ที่ให้ตรงกัน

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

export function isValidReportCategory(code: string): code is ReportCategory {
  return CATEGORY_MAP.has(code as ReportCategory)
}

export function getReportCategoryLabel(code: string): string {
  return CATEGORY_MAP.get(code as ReportCategory)?.label ?? code
}

export function isWriterRoutedCategory(code: string): boolean {
  return CATEGORY_MAP.get(code as ReportCategory)?.routedTo === 'writer'
}
