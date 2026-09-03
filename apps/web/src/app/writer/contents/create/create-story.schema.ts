import { z } from 'zod'
import {
  STORY_AGE_RATING_MAX,
  STORY_COVER_ACCEPTED_TYPES,
  STORY_COVER_MAX_FILE_SIZE,
  STORY_SLUG_MAX_LENGTH,
  STORY_SYNOPSIS_MAX_LENGTH,
  STORY_TITLE_MAX_LENGTH,
  StoryStatus,
  StoryType,
} from '@/constants/story.constant'

export const createStorySchema = z.object({
  type: z.enum(StoryType),
  title: z.string().trim().min(1, 'กรุณากรอกชื่อเรื่อง')
    .max(STORY_TITLE_MAX_LENGTH, `ชื่อเรื่องต้องไม่เกิน ${STORY_TITLE_MAX_LENGTH} ตัวอักษร`),
  slug: z.string().trim().min(1, 'กรุณากรอกลิงก์ URL')
    .max(STORY_SLUG_MAX_LENGTH, `ลิงก์ URL ต้องไม่เกิน ${STORY_SLUG_MAX_LENGTH} ตัวอักษร`),
  synopsis: z.string().max(
    STORY_SYNOPSIS_MAX_LENGTH,
    `เรื่องย่อต้องไม่เกิน ${STORY_SYNOPSIS_MAX_LENGTH} ตัวอักษร`,
  ),
  status: z.enum(StoryStatus),
  age_rating: z.string().refine((value) => {
    if (!value.trim()) return true
    const ageRating = Number(value)
    return Number.isInteger(ageRating) && ageRating >= 0 && ageRating <= STORY_AGE_RATING_MAX
  }, `เรทอายุต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง ${STORY_AGE_RATING_MAX}`),
  primary_genre_id: z.string().min(1, 'กรุณาเลือกหมวดหมู่หลัก').uuid('หมวดหมู่หลักไม่ถูกต้อง'),
  secondary_genre_id: z.string().refine(
    (value) => !value || z.string().uuid().safeParse(value).success,
    'หมวดหมู่รองไม่ถูกต้อง',
  ).optional(),
  cover: z.preprocess(
    (value) => value instanceof File && value.size === 0 ? undefined : value,
    z.instanceof(File)
      .refine(
        (file) => STORY_COVER_ACCEPTED_TYPES.includes(
          file.type as (typeof STORY_COVER_ACCEPTED_TYPES)[number],
        ),
        'รองรับเฉพาะไฟล์ JPG, PNG และ WebP',
      )
      .refine((file) => file.size <= STORY_COVER_MAX_FILE_SIZE, 'ขนาดไฟล์ต้องไม่เกิน 5 MB')
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
