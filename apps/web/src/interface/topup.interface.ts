export type TopupStatus = 'pending' | 'paid' | 'expired' | 'failed'

export interface TopupPackage {
  amount: string
  bonus: string
}

export interface TopupPageConfig {
  topup: {
    packages: TopupPackage[]
  }
  enabled: boolean
}

export interface TopupTransaction {
  id: string
  requested_amount: string
  base_coins: string
  bonus_coins: string
  credited_coins: string
  status: TopupStatus
  expires_at: string | null
  paid_at: string | null
  created_at: string
}

export interface CreateTopupResponse {
  transaction: TopupTransaction
  payment: {
    provider_payment_id: string
    amount_check_satang: number
    qr_image_base64: string
    time_out: number
  }
}

export interface GetTopupResponse {
  transaction: TopupTransaction
}

export interface TopupHistoryResponse {
  transactions: TopupTransaction[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
