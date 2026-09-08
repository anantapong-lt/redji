export const WRITER_APPLICATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approve',
  REJECTED: 'reject',
} as const

export const WRITER_APPLICATION_STATUSES = Object.values(WRITER_APPLICATION_STATUS)
export type WriterApplicationStatus = (typeof WRITER_APPLICATION_STATUS)[keyof typeof WRITER_APPLICATION_STATUS]
