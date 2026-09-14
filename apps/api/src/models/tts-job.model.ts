export const TTS_JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  DONE: 'done',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const

export const TTS_JOB_STATUSES = [
  TTS_JOB_STATUS.QUEUED,
  TTS_JOB_STATUS.PROCESSING,
  TTS_JOB_STATUS.DONE,
  TTS_JOB_STATUS.FAILED,
  TTS_JOB_STATUS.CANCELLED,
] as const

export type TtsJobStatus = (typeof TTS_JOB_STATUSES)[number]
