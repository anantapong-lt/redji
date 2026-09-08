import type { NotificationType } from '@/constants/notification.constant'

export type { NotificationType }

export interface UserNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  target_url: string | null
  data: Record<string, unknown>
  read_at: string | null
  created_at: string
}

export interface NotificationsResponse {
  notifications: UserNotification[]
  pagination: {
    page: number
    limit: number
    total: number
    total_pages: number
  }
}
