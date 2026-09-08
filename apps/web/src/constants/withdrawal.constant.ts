export const WITHDRAWAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  PAID: 'paid',
  REJECTED: 'rejected',
} as const

export type WithdrawalStatus = (typeof WITHDRAWAL_STATUS)[keyof typeof WITHDRAWAL_STATUS]

export const WITHDRAWAL_STATUS_LABEL: Record<WithdrawalStatus, string> = {
  [WITHDRAWAL_STATUS.PENDING]: 'รอตรวจสอบ',
  [WITHDRAWAL_STATUS.APPROVED]: 'อนุมัติแล้ว',
  [WITHDRAWAL_STATUS.PAID]: 'โอนเงินแล้ว',
  [WITHDRAWAL_STATUS.REJECTED]: 'ไม่อนุมัติ',
}
