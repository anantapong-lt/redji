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

export const STORY_STATUS_OPTIONS = [
  { value: StoryStatus.DRAFT, label: 'ฉบับร่าง' },
  { value: StoryStatus.ONGOING, label: 'กำลังเผยแพร่' },
  { value: StoryStatus.COMPLETED, label: 'จบแล้ว' },
  { value: StoryStatus.HIATUS, label: 'หยุดชั่วคราว' },
  { value: StoryStatus.CANCELLED, label: 'ยกเลิก' },
] as const
