// =============================================================
// Novel Platform — รายชื่อธนาคารไทย (สำหรับผูกบัญชีถอนเงิน)
// วางไว้ที่: apps/api/src/lib/thai-banks.ts
// =============================================================
//
// เป็นรายชื่อ+รหัสธนาคารสาธารณะ (ไม่ใช่ทรัพย์สินทางปัญญา) ใช้แค่ validate bank_code ที่ส่งมา
// จากฝั่ง client ว่าอยู่ในลิสต์จริง — ยังไม่มีโลโก้จริงแนบมาด้วย (user แจ้งว่าจะเอามาใส่เองทีหลัง)
// ฝั่ง apps/web มีลิสต์เดียวกันแยกไว้ต่างหาก (apps/web/src/lib/thai-banks.ts) เพราะ 2 แอปนี้
// เป็นคนละ TS project แชร์ import ตรงๆ ไม่ได้ — ถ้าจะเพิ่ม/แก้ธนาคาร ต้องแก้ทั้ง 2 ที่ให้ตรงกัน

export interface ThaiBank {
  code: string
  name: string
}

export const THAI_BANKS: ThaiBank[] = [
  { code: 'kbank', name: 'ธนาคารกสิกรไทย' },
  { code: 'scb', name: 'ธนาคารไทยพาณิชย์' },
  { code: 'bbl', name: 'ธนาคารกรุงเทพ' },
  { code: 'ktb', name: 'ธนาคารกรุงไทย' },
  { code: 'bay', name: 'ธนาคารกรุงศรีอยุธยา' },
  { code: 'ttb', name: 'ธนาคารทหารไทยธนชาต' },
  { code: 'gsb', name: 'ธนาคารออมสิน' },
  { code: 'baac', name: 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร' },
  { code: 'uob', name: 'ธนาคารยูโอบี' },
  { code: 'cimb', name: 'ธนาคารซีไอเอ็มบี ไทย' },
  { code: 'kkp', name: 'ธนาคารเกียรตินาคินภัทร' },
  { code: 'lhbank', name: 'ธนาคารแลนด์ แอนด์ เฮ้าส์' },
  { code: 'tisco', name: 'ธนาคารทิสโก้' },
  { code: 'icbc', name: 'ธนาคารไอซีบีซี (ไทย)' },
  { code: 'ghb', name: 'ธนาคารอาคารสงเคราะห์' },
]

const BANK_MAP = new Map(THAI_BANKS.map((b) => [b.code, b.name]))

export function isValidBankCode(code: string): boolean {
  return BANK_MAP.has(code)
}

export function getBankName(code: string): string {
  return BANK_MAP.get(code) ?? code
}
