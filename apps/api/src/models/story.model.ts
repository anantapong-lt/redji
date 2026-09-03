export const STORY_TYPE = {
  NOVEL: 'novel',
  MANGA: 'manga',
} as const

export const STORY_STATUS = {
  DRAFT: 'draft',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  HIATUS: 'hiatus',
  CANCELLED: 'cancelled',
} as const

export const STORY_TYPES = [
  STORY_TYPE.NOVEL,
  STORY_TYPE.MANGA,
] as const

export const STORY_STATUSES = [
  STORY_STATUS.DRAFT,
  STORY_STATUS.ONGOING,
  STORY_STATUS.COMPLETED,
  STORY_STATUS.HIATUS,
  STORY_STATUS.CANCELLED,
] as const

export const CHAPTER_STATUSES = [
  'draft',
  'scheduled',
  'published',
  'hidden',
] as const

export type StoryType = (typeof STORY_TYPES)[number]
export type StoryStatus = (typeof STORY_STATUSES)[number]
export type ChapterStatus = (typeof CHAPTER_STATUSES)[number]
