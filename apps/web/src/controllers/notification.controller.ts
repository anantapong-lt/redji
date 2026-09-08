import { apiRequest } from '@/lib/api-client'
import type { NotificationsResponse, UserNotification } from '@/interface/notification.interface'

export function getNotifications(page: number, limit: number, accessToken: string): Promise<NotificationsResponse> {
  return apiRequest(`/notifications?page=${page}&limit=${limit}`, { accessToken, cache: 'no-store' })
}

export function getUnreadNotificationCount(accessToken: string): Promise<{ count: number }> {
  return apiRequest('/notifications/unread-count', { accessToken, cache: 'no-store' })
}

export function markNotificationRead(notificationId: string, accessToken: string): Promise<{ notification: UserNotification }> {
  return apiRequest(`/notifications/${notificationId}/read`, { method: 'PATCH', accessToken })
}
