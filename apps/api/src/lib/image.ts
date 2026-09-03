// =============================================================
// Novel Platform — Image Processing Service
// วางไว้ที่: apps/api/src/lib/image.ts
// =============================================================
//
// จุดเดียวที่ทำ resize + แปลง webp ให้ทุก endpoint ที่อัปโหลดรูปใช้ร่วมกัน
// (ปกนิยาย, รูปการ์ตูนแต่ละหน้า, และของในอนาคตเช่นรูปโปรไฟล์/แบนเนอร์โปรโมต)
// เพิ่ม preset ใหม่ใน IMAGE_PRESETS ได้เลยถ้ามีจุดอัปโหลดใหม่ ไม่ต้องเขียน resize logic ซ้ำ
// =============================================================

import sharp from 'sharp'

export interface ImagePreset {
  maxWidth: number
  maxHeight: number
  quality: number // 1-100, ยิ่งสูงยิ่งคมชัดแต่ไฟล์ใหญ่ขึ้น
}

// ---- ขนาด/คุณภาพต่อประเภทรูปในเว็บ ----
// fit: 'inside' เสมอ (resize ให้พอดีกรอบ ไม่ครอบตัด ไม่บิดสัดส่วน) แค่ "ลดขนาดถ้าใหญ่เกิน"
// ไม่ได้ตั้งใจ crop เป็นสี่เหลี่ยม/สัดส่วนตายตัว — ปล่อยให้ CSS (object-cover) จัดการตอนแสดงผลแทน
export const IMAGE_PRESETS = {
  // ปกนิยาย/การ์ตูน — แนวตั้ง ใช้เป็น thumbnail เป็นหลัก ไม่ต้องคมชัดมาก
  cover: { maxWidth: 800, maxHeight: 1200, quality: 82 },
  // รูปโปรไฟล์ผู้ใช้ — เล็ก แสดงเป็นวงกลม/สี่เหลี่ยมเล็กๆ
  profile: { maxWidth: 512, maxHeight: 512, quality: 80 },
  // Hero Carousel / แบนเนอร์โปรโมต — แนวนอนกว้าง
  banner: { maxWidth: 1920, maxHeight: 800, quality: 82 },
  // รูปเนื้อหาการ์ตูนแต่ละหน้า — user จ่ายเงินอ่าน ต้องคมชัดกว่ารูปตกแต่งทั่วไป
  mangaPage: { maxWidth: 1600, maxHeight: 2400, quality: 88 },
  // หลักฐานยืนยันบัญชีธนาคาร (สมุดบัญชี/บัตรประชาชน) — ต้องอ่านเลขบัญชี/ชื่อออกชัดเจน
  // แอดมินใช้ตรวจสอบจริงก่อนอนุมัติ บีบคุณภาพน้อยกว่า preset อื่นๆ ทั้งหมด
  bankDocument: { maxWidth: 2000, maxHeight: 2000, quality: 92 },
} as const satisfies Record<string, ImagePreset>

export type ImagePresetName = keyof typeof IMAGE_PRESETS

export interface ProcessedImage {
  buffer: Buffer
  contentType: 'image/webp'
  ext: 'webp'
}

// ---- Resize (ถ้าใหญ่เกิน) + แปลงเป็น webp เสมอ ----
// รับ buffer ของรูปต้นฉบับ (jpeg/png/webp — เช็ค isAllowedImageType() ก่อนเรียกแล้ว)
// คืน buffer ใหม่ที่ประมวลผลแล้ว พร้อม contentType/ext ที่ใช้ต่อได้ทันที
export async function processImage(input: Buffer, presetName: ImagePresetName): Promise<ProcessedImage> {
  const preset = IMAGE_PRESETS[presetName]

  const buffer = await sharp(input)
    .resize(preset.maxWidth, preset.maxHeight, {
      fit: 'inside',            // ไม่ครอบตัด แค่ลดขนาดให้พอดีกรอบ
      withoutEnlargement: true, // รูปเล็กกว่ากรอบอยู่แล้วไม่ต้องขยาย (ขยายแล้วภาพแตก)
    })
    .webp({ quality: preset.quality })
    .toBuffer()

  return { buffer, contentType: 'image/webp', ext: 'webp' }
}
