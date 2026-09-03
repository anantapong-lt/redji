'use client'

/**
 * hooks/use-writer-application.ts — ดึงคำขอเป็นนักเขียนของตัวเองจาก backend จริง
 *
 * 2026-07-30: แทนที่ writer-application.store.ts เดิม (mock, เก็บแค่ localStorage) — ตอนนี้
 * ต่อ GET /users/me/writer-application จริงแล้ว (ดู user.routes.ts/user.service.ts ฝั่ง apps/api)
 */

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useUser } from '@/store/auth.store'

export interface WriterApplication {
  id: string
  user_prefix: string
  first_name: string
  last_name: string
  national_id: string | null
  id_address: string | null
  id_province: string | null
  id_district: string | null
  id_subdistrict: string | null
  id_postal_code: string | null
  current_address: string | null
  current_province: string | null
  current_district: string | null
  current_subdistrict: string | null
  current_postal_code: string | null
  user_phone: string
  bank_name: string
  bank_branch: string | null
  bank_number: string | null
  status: 'pending' | 'approve' | 'rejected'
  application_type: 'new_writer' | 'edit'
  reject_reason: string | null
  created_at: string
}

export function useMyWriterApplication() {
  const user = useUser()

  return useQuery({
    queryKey: ['writer-application', 'me'],
    queryFn: () =>
      api
        .get<{ data: WriterApplication | null }>('/users/me/writer-application')
        .then((res) => res.data),
    enabled: Boolean(user),
  })
}
