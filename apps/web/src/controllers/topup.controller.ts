import type { CreateTopupResponse, GetTopupResponse } from '@/interface/topup.interface'
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
