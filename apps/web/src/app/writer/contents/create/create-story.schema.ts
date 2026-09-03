import { z } from 'zod'
import { StoryStatus, StoryType } from '@/constants/story.constant'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const createStorySchema = z.object({
  type: z.enum(StoryType),
  title: z.string().trim().min(1, 'กรุณากรอกชื่อเรื่อง').max(255, 'ชื่อเรื่องต้องไม่เกิน 255 ตัวอักษร'),
  slug: z.string().trim().min(1, 'กรุณากรอกลิงก์ URL').max(255, 'ลิงก์ URL ต้องไม่เกิน 255 ตัวอักษร'),
  synopsis: z.string().max(140, 'เรื่องย่อต้องไม่เกิน 140 ตัวอักษร'),
  status: z.enum(StoryStatus),
  age_rating: z.string().refine((value) => {
    if (!value.trim()) return true
    const ageRating = Number(value)
    return Number.isInteger(ageRating) && ageRating >= 0 && ageRating <= 32_767
  }, 'เรทอายุต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 32767'),
  primary_genre_id: z.string().min(1, 'กรุณาเลือกหมวดหมู่หลัก').uuid('หมวดหมู่หลักไม่ถูกต้อง'),
  secondary_genre_id: z.string().refine(
    (value) => !value || z.string().uuid().safeParse(value).success,
    'หมวดหมู่รองไม่ถูกต้อง',
  ).optional(),
  cover: z.preprocess(
    (value) => value instanceof File && value.size === 0 ? undefined : value,
    z.instanceof(File)
      .refine((file) => ACCEPTED_IMAGE_TYPES.includes(file.type), 'รองรับเฉพาะไฟล์ JPG, PNG และ WebP')
      .refine((file) => file.size <= MAX_FILE_SIZE, 'ขนาดไฟล์ต้องไม่เกิน 5 MB')
      .optional(),
  ),
}).superRefine((data, context) => {
  if (data.secondary_genre_id && data.secondary_genre_id === data.primary_genre_id) {
    context.addIssue({
      code: 'custom',
      path: ['secondary_genre_id'],
      message: 'หมวดหมู่รองต้องไม่ซ้ำกับหมวดหมู่หลัก',
    })
  }
})
