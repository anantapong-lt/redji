export enum StoryType {
  NOVEL = 'novel',
  MANGA = 'manga',
}

export enum StoryStatus {
  DRAFT = 'draft',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  HIATUS = 'hiatus',
  CANCELLED = 'cancelled',
}

export const STORY_TITLE_MAX_LENGTH = 255
export const STORY_SLUG_MAX_LENGTH = 255
export const STORY_SYNOPSIS_MAX_LENGTH = 140
export const STORY_AGE_RATING_OPTIONS = [
  { value: '0', label: 'ทั่วไป (PG)' },
  { value: '18', label: '18+ ขึ้นไป (NC)' },
] as const
export const STORY_COVER_MAX_FILE_SIZE = 5 * 1024 * 1024
export const STORY_COVER_ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export const STORY_STATUS_OPTIONS = [
  { value: StoryStatus.DRAFT, label: 'ฉบับร่าง' },
  { value: StoryStatus.ONGOING, label: 'กำลังเผยแพร่' },
  { value: StoryStatus.COMPLETED, label: 'จบแล้ว' },
  { value: StoryStatus.HIATUS, label: 'หยุดชั่วคราว' },
  { value: StoryStatus.CANCELLED, label: 'ยกเลิก' },
] as const
