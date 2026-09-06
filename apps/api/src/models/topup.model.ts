export enum TopupStatus {
  PENDING = 'pending',
  PAID = 'paid',
  EXPIRED = 'expired',
  FAILED = 'failed',
}

export const TOPUP_STATUSES = Object.values(TopupStatus)
