// =============================================================
// Novel Platform — Cloudflare R2 Service
// วางไว้ที่: apps/api/src/lib/r2.ts
// =============================================================
//
// R2 ใช้ S3-compatible API → ใช้ @aws-sdk/client-s3 ได้เลย
// แค่เปลี่ยน endpoint ให้ชี้ไปที่ Cloudflare แทน AWS
// =============================================================

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'

// ---- สร้าง S3Client ที่ชี้ไป Cloudflare R2 ----
const r2 = new S3Client({
  region: 'auto',   // R2 ไม่มี region ปกติ ใช้ 'auto' เสมอ
  endpoint: process.env.R2_ENDPOINT_URL!,
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

// ---- ชื่อ bucket ----
const BUCKET = process.env.R2_BUCKET_NAME!

// ---- Public base URL (สำหรับต่อกับ key เพื่อให้ดูภาพได้) ----
// เช่น https://pub-xxxx.r2.dev/covers/abc123/cover.jpg
const PUBLIC_URL = process.env.R2_PUBLIC_URL!

// =============================================================
// Key Generators — กำหนด path ของไฟล์ใน bucket
// ทำไมต้องมี convention? เพื่อให้ลบ/แทนที่ไฟล์เก่าได้ง่าย
// =============================================================

// Cover image ของผลงาน — 1 เรื่องมี cover 1 รูป
// path: covers/{uuid}/cover.jpg
export function coverKey(workUuid: string, ext: string): string {
  return `covers/${workUuid}/cover.${ext}`
}

// ภาพของแต่ละตอน (manga)
// path: manga/{p_id}/{ep_no}/{sort_order}.jpg  ← path นี้ห้ามเปลี่ยน เพราะไฟล์เก่าใน R2 ใช้ path นี้อยู่
// ใช้ p_id (ตัวเลข) เพื่อ group ภาพของเรื่องเดียวกันไว้ด้วยกัน
export function episodeImageKey(pId: string, epNo: number, sortOrder: number, ext: string): string {
  return `manga/${pId}/${epNo}/${sortOrder}.${ext}`
}

// รูปโปรไฟล์ของ user — ใส่ version (timestamp) ต่อท้ายเสมอ ไม่ใช่ key คงที่แบบเดิม
// (`avatar.webp` ตายตัว) เพราะ URL คงที่ทำให้ browser/R2 CDN cache รูปเก่าค้างไว้ ไม่ยอมโหลดรูป
// ใหม่ทั้งที่เนื้อไฟล์เปลี่ยนไปแล้วจริงบน R2 — เจอจริงจาก user รายงานว่าอัปโหลดสำเร็จแต่รูปไม่
// เปลี่ยน (ดู KNOWN_ISSUES.md) ต้องลบรูปเก่าเองด้วย getKeyFromUrl() หลังอัปโหลดรูปใหม่สำเร็จ
export function avatarKey(userUuid: string, ext: string, version: number): string {
  return `avatars/${userUuid}/avatar-${version}.${ext}`
}

// รูป Hero Carousel — เหตุผล version เดียวกับ avatarKey (กัน CDN cache ค้างตอนแอดมินแก้ไขรูปทับ
// ของเดิม, migration 028)
export function carouselKey(carouselId: string, version: number, ext: string): string {
  return `carousels/${carouselId}/banner-${version}.${ext}`
}

// หลักฐานยืนยันบัญชีธนาคาร (bank_change_requests, migration 031) — ใส่ version เพราะขอเปลี่ยน
// บัญชีซ้ำได้หลายครั้ง (โดนปฏิเสธแล้วส่งใหม่) เหตุผล cache เดียวกับ avatarKey/carouselKey
export function bankDocumentKey(userUuid: string, version: number, ext: string): string {
  return `bank-docs/${userUuid}/doc-${version}.${ext}`
}

// สลิปโอนเงินจริง แนบตอนแอดมินอนุมัติคำขอถอนเงิน (withdrawals.transfer_proof_url, migration 033)
// ไม่ใส่ version เหมือน avatarKey/bankDocumentKey เพราะคำขอถอนเงิน 1 รายการอนุมัติได้แค่ครั้งเดียว
// เท่านั้น (WITHDRAWAL_NOT_PENDING กันการอนุมัติซ้ำ) ไม่มีทางถูกอัปโหลดทับที่ key เดิมได้เลย
export function withdrawalProofKey(withdrawalId: string, ext: string): string {
  return `withdrawal-proofs/${withdrawalId}/slip.${ext}`
}

// =============================================================
// Core Functions
// =============================================================

// ---- Upload ไฟล์ขึ้น R2 ----
// key     = path ใน bucket เช่น "covers/abc123/cover.jpg"
// body    = ข้อมูลไฟล์จริง (Buffer)
// contentType = MIME type เช่น "image/jpeg", "image/png"
export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      Body:        body,
      ContentType: contentType,
    })
  )
}

// ---- ลบไฟล์จาก R2 ----
// ใช้ตอนลบ episode หรือเปลี่ยน cover image
// ⚠️ ใน production จริงควรเรียกผ่าน BullMQ queue
//    แต่ตอนนี้ยังไม่ได้ทำ queue — ลบ sync ไปก่อน
export async function deleteFile(key: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key:    key,
    })
  )
}

// ---- แปลง key → URL สาธารณะ ----
// เช่น "covers/abc123/cover.jpg"
//   → "https://pub-xxxx.r2.dev/covers/abc123/cover.jpg"
export function getPublicUrl(key: string): string {
  return `${PUBLIC_URL}/${key}`
}

// ---- แปลง URL สาธารณะ → key (ย้อนกลับจาก getPublicUrl) ----
// ใช้ตอนต้องลบไฟล์เก่าที่รู้แค่ URL ที่เก็บไว้ใน DB (เช่น avatar เก่าตอนอัปโหลดใหม่ทับ)
export function getKeyFromUrl(url: string): string {
  return url.replace(`${PUBLIC_URL}/`, '')
}

// ---- Helper: แยก extension จากชื่อไฟล์ ----
// เช่น "photo.jpg" → "jpg"
export function getExtension(filename: string): string {
  const parts = filename.split('.')
  return parts[parts.length - 1].toLowerCase()
}

// ---- Helper: เช็คว่า MIME type นี้รับได้ไหม ----
// รับเฉพาะ image เท่านั้น ป้องกัน upload ไฟล์แปลกๆ
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function isAllowedImageType(contentType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(contentType)
}
