/**
 * lib/special-tags.ts — "หมวดหมู่ย่อยพิเศษ" 18+ / BL / GL (2026-08-08, rev.3)
 *
 * rev.2: เดิมรอบแรกทำ BL/GL (ตอนนั้นชื่อ วาย/ยูริ) เป็น boolean column แยก (works.is_yaoi/
 * is_yuri) — user แก้ทีหลังว่าไม่ต้องมี column คู่ขนาน ให้เก็บเป็น string ธรรมดาอยู่ใน works.tags
 * (หมวดหมู่เสริม) แทน ใช้ระบบ tag ทั่วไปทั้งชุดที่มีอยู่แล้ว (ค้นหา/โควต้า/ลบ tag ไม่มีใครใช้)
 * "พิเศษ" ของ BL/GL คือแค่ (1) ต้องอยู่ลำดับแรกสุดของ tags เสมอ (2) render สีเฉพาะตัวแทนสีเทา
 * ปกติของ tag ทั่วไป — เช็คจาก "ชื่อ string ตรงกับ SPECIAL_TAG_NAMES" ล้วนๆ ไม่มี flag แยกเก็บ
 *
 * 18+ ยังคงคนละแกนกับ tags เหมือนเดิม (ผูกกับ works.age_rate ไม่ใช่ tag)
 *
 * rev.3 (2026-08-08): สีเดิม (18+ พื้นดำ, BL น้ำเงินเข้ม, GL ม่วงเข้ม) user ชี้ว่าสะดุดตาเกินไปไม่เข้ากับ
 * โทนเว็บ — เปลี่ยนเป็นโทนพาสเทลอ่อนลงทั้งหมด: BL ฟ้าพาสเทล, GL ม่วงลิลลี่พาสเทล, 18+ ชมพูเข้มกว่า
 * พาสเทลนิดหน่อย (ยังต้องเด่นกว่า BL/GL เพราะเป็นคำเตือนอายุ ไม่ใช่แค่หมวดหมู่) — ใช้เป็น "สีฐาน"
 * ร่วมกันทั้ง 2 ที่ที่โชว์: pill เดิม (SpecialTagPill, ใช้ตอนไม่ใช่บริบทการ์ดมีรูป เช่น GenreTagRow
 * หน้ารายละเอียด, ตัวเลือกตอนสร้าง/แก้ไขผลงาน) กับ ribbon ใหม่ (SpecialTagRibbon, มุมขวาบนการ์ด
 * ที่มีรูปปก — แทนที่ pill inline เดิม + วงกลม M เดิม) — pill ใช้เฉดอ่อนกว่า ribbon ใช้ gradient ให้
 * เข้ากับพื้นที่ mixed: ถ้า work มี 18+ ผสมกับ BL/GL ด้วย gradient ของ ribbon จะไล่ไปจบที่สีชมพูเข้ม
 * ของ 18+ แทนปลายสีเดิม เพื่อสื่อว่า "ผสมกัน" โดยไม่ต้องมี 2 ribbon ซ้อนกัน
 */

export type SpecialTagKey = 'age18' | 'bl' | 'gl'

export interface SpecialTagStyle {
  key: SpecialTagKey
  label: string // ข้อความเต็มของ pill — สำหรับ bl/gl ตรงกับ string ที่เก็บจริงใน tags[] เป๊ะ
  bg: string
  text: string
  labelText: string // ใช้กับ label ข้างสวิชในฟอร์ม (พื้นหลังขาว/สว่างเสมอ) — เข้มกว่า text ด้านบน
  // rev.3 — ribbon มุมการ์ด: from/to ของ bg-gradient-to-br (โทนเดียวกับ pill แต่เข้มขึ้นพอให้
  // ตัวหนังสือขาวอ่านออก) + ปลาย gradient เวอร์ชัน "ผสมกับ 18+" (ไล่ไปจบที่ชมพูเข้มของ age18 แทน)
  ribbonFrom: string
  ribbonTo: string
  ribbonToMixed: string
}

export const SPECIAL_TAG_STYLES: Record<SpecialTagKey, SpecialTagStyle> = {
  age18: {
    key: 'age18',
    label: '18+',
    bg: 'bg-pink-100',
    text: 'text-pink-700',
    labelText: 'text-pink-700',
    ribbonFrom: 'from-pink-400',
    ribbonTo: 'to-rose-600',
    ribbonToMixed: 'to-rose-600', // ตัวเองคือปลายทาง mixed อยู่แล้ว ไม่มีอะไรให้ไล่ต่อ
  },
  bl: {
    key: 'bl',
    label: 'BL',
    bg: 'bg-sky-100',
    text: 'text-sky-700',
    labelText: 'text-sky-700',
    ribbonFrom: 'from-sky-300',
    ribbonTo: 'to-sky-500',
    ribbonToMixed: 'to-rose-600', // มี 18+ ผสม → ปลาย gradient กลายเป็นชมพูเข้มของ M แทน
  },
  gl: {
    key: 'gl',
    label: 'GL',
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    labelText: 'text-purple-700',
    ribbonFrom: 'from-purple-300',
    ribbonTo: 'to-violet-500',
    ribbonToMixed: 'to-rose-600', // มี 18+ ผสม → ปลาย gradient กลายเป็นชมพูเข้มของ M แทน
  },
}

// ชื่อ tag ที่นับเป็น "พิเศษ" — เทียบตรงตัวกับ label (case-sensitive เหมือน tag ทั่วไปทั้งระบบ)
export const SPECIAL_TAG_NAMES: string[] = [SPECIAL_TAG_STYLES.bl.label, SPECIAL_TAG_STYLES.gl.label]

function findSpecialTagStyle(tagName: string): SpecialTagStyle | null {
  if (tagName === SPECIAL_TAG_STYLES.bl.label) return SPECIAL_TAG_STYLES.bl
  if (tagName === SPECIAL_TAG_STYLES.gl.label) return SPECIAL_TAG_STYLES.gl
  return null
}

// แยก tags[] เป็น "ตัวพิเศษ" (เอาตัวแรกที่เจอ — ควร prepend ไว้ตำแหน่ง 0 อยู่แล้วจากฝั่งเขียน)
// กับ "ตัวที่เหลือปกติ" (ตัดตัวพิเศษออกแล้ว กันโชว์ซ้ำ 2 ที่ในแถวเดียวกัน)
export function splitTags(tags: string[] | null | undefined): { special: SpecialTagStyle | null; rest: string[] } {
  const list = tags ?? []
  for (const t of list) {
    const style = findSpecialTagStyle(t)
    if (style) return { special: style, rest: list.filter((x) => x !== t) }
  }
  return { special: null, rest: list }
}

// ---- Ribbon มุมการ์ด (rev.3) ----
// รวม BL/GL (จาก tags[]) กับ 18+ (จาก age_rate) เป็น "ป้ายเดียว" ต่อการ์ด — ไม่โชว์ 2 ribbon
// ซ้อนกัน ถ้ามีทั้งคู่ให้ BL/GL ชนะเรื่อง label (โชว์ชื่อ BL/GL) แต่ gradient จบที่สีของ 18+ แทน
// เพื่อสื่อว่า "ผสมกัน" ถ้ามีแค่ 18+ อย่างเดียวไม่มี BL/GL ก็โชว์ "18+" เป็น label ตรงๆ
export function getCardRibbon(
  ageRate: string | null | undefined,
  tags: string[] | null | undefined,
): { label: string; from: string; to: string } | null {
  const isAdult = ageRate === '18+'
  const { special } = splitTags(tags)

  if (special) {
    return {
      label: special.label,
      from: special.ribbonFrom,
      to: isAdult ? special.ribbonToMixed : special.ribbonTo,
    }
  }

  if (isAdult) {
    const age18 = SPECIAL_TAG_STYLES.age18
    return { label: age18.label, from: age18.ribbonFrom, to: age18.ribbonTo }
  }

  return null
}
