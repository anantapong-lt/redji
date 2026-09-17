import type { CreateTopupResponse, GetTopupResponse, TopupHistoryResponse } from '@/interface/topup.interface'
import { apiRequest } from '@/lib/api-client'

export function createTopup(
  amount: number,
  accessToken: string,
): Promise<CreateTopupResponse> {
  return apiRequest<CreateTopupResponse>('/topups', {
    method: 'POST',
    accessToken,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  })
}

export function getTopup(
  topupId: string,
  accessToken: string,
): Promise<GetTopupResponse> {
  return apiRequest<GetTopupResponse>(`/topups/${encodeURIComponent(topupId)}`, {
    accessToken,
  })
}

export function getTopupHistory(
  page: number,
  limit: number,
  accessToken: string,
): Promise<TopupHistoryResponse> {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) })
  return apiRequest<TopupHistoryResponse>(`/topups?${query}`, { accessToken })
}
