// lib/thai-banks.ts — รายชื่อธนาคารไทย (สำหรับ dropdown เลือกธนาคารตอนผูก/เปลี่ยนบัญชีถอนเงิน)
//
// รายการเดียวกับ apps/api/src/lib/thai-banks.ts เป๊ะ — 2 แอปนี้เป็นคนละ TS project แชร์ import
// ตรงๆ ไม่ได้ ถ้าจะเพิ่ม/แก้ธนาคาร ต้องแก้ทั้ง 2 ที่ให้ตรงกัน
//
// ยังไม่มีโลโก้ธนาคารจริงแนบมาด้วย — user แจ้งว่าจะเอามาใส่เองทีหลัง ตอนนี้ใช้ไอคอนกลาง
// (Landmark จาก lucide-react) แทนทุกธนาคารไปก่อน ไม่ปั้นสี/โลโก้ปลอมขึ้นมาเอง

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

export function getBankName(code: string): string {
  return BANK_MAP.get(code) ?? code
}
