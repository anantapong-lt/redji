export const NOTIFICATION_TYPE = {
  WITHDRAWAL_APPROVED: 'withdrawal_approved',
  WITHDRAWAL_REJECTED: 'withdrawal_rejected',
  WRITER_APPLICATION_APPROVED: 'writer_application_approved',
  WRITER_APPLICATION_REJECTED: 'writer_application_rejected',
} as const

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE]
