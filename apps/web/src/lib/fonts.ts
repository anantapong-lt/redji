import { Noto_Sans_Thai, Noto_Serif_Thai, Sriracha, Cherry_Bomb_One } from 'next/font/google'

// ฟอนต์หลักของเว็บ (ไม่มีหัว) — ใช้กับ UI ทั่วไปทั้งเว็บ ประกาศครั้งเดียวที่ layout.tsx
export const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

// ฟอนต์ไทย "มีหัว" แบบดั้งเดิม เอาไว้อ่านเนื้อหายาวๆ โดยเฉพาะ (เรื่องย่อ, หน้าอ่านนิยาย)
// ต่างจากฟอนต์หลัก Noto Sans Thai ที่เป็นแบบไม่มีหัว
export const notoSerifThai = Noto_Serif_Thai({
  subsets: ['thai'],
  weight: ['400', '500', '600'],
  variable: '--font-reading',
  display: 'swap',
})

// ฟอนต์ลายมือสำหรับหน้าอ่าน (ตัวเลือกที่ 3 ใน reading-settings-popover.tsx) — Sriracha เป็นฟอนต์
// ไทยตระกูล sans ในหมวด handwriting ของ Google Fonts ตัวเดียวที่รองรับภาษาไทยเต็มตัว (มีแค่
// weight 400 ตัวเดียว เป็นเรื่องปกติของฟอนต์ลายมือ)
export const sriracha = Sriracha({
  subsets: ['thai'],
  weight: '400',
  variable: '--font-handwriting',
  display: 'swap',
})

// ฟอนต์โลโก้ "READJI" ใน navbar (ตัวอักษรล้วนๆ ภาษาอังกฤษ ไม่ต้องมี subset ไทย) — ฟอนต์เดียว
// weight 400 ตัวเดียวเหมือนที่ user ส่ง CSS มา (.cherry-bomb-one-regular)
export const cherryBombOne = Cherry_Bomb_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-logo',
  display: 'swap',
})
