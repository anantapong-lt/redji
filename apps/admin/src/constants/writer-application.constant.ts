export const WRITER_APPLICATION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approve',
  REJECTED: 'reject',
} as const

export type WriterApplicationStatus = (typeof WRITER_APPLICATION_STATUS)[keyof typeof WRITER_APPLICATION_STATUS]

export const WRITER_APPLICATION_STATUS_LABEL: Record<WriterApplicationStatus, string> = {
  [WRITER_APPLICATION_STATUS.PENDING]: 'รอตรวจสอบ',
  [WRITER_APPLICATION_STATUS.APPROVED]: 'อนุมัติแล้ว',
  [WRITER_APPLICATION_STATUS.REJECTED]: 'ไม่อนุมัติ',
}
