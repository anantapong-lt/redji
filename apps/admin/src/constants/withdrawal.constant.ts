export const WITHDRAWAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  PAID: 'paid',
  REJECTED: 'rejected',
} as const

export const WITHDRAWAL_STATUSES = Object.values(WITHDRAWAL_STATUS)
export type WithdrawalStatus = (typeof WITHDRAWAL_STATUS)[keyof typeof WITHDRAWAL_STATUS]
