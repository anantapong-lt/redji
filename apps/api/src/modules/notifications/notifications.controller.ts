import { status } from 'elysia'
import type { notificationsQuerySchema } from './notifications.schema'
import { findNotifications, findUnreadNotificationCount, markAllNotificationsRead, markNotificationRead } from './notifications.service'

export async function getNotifications(userId: string, query: typeof notificationsQuerySchema.static) {
  try {
    return await findNotifications(userId, query.page ?? 1, query.limit ?? 10)
  } catch (error) {
    console.error('Unable to load notifications', error)
    return status(500, { message: 'ไม่สามารถโหลดการแจ้งเตือนได้' })
  }
}

export async function getUnreadNotificationCount(userId: string) {
  try {
    return { count: await findUnreadNotificationCount(userId) }
  } catch (error) {
    console.error('Unable to load unread notification count', error)
    return status(500, { message: 'ไม่สามารถโหลดจำนวนการแจ้งเตือนได้' })
  }
}

export async function readNotification(userId: string, notificationId: string) {
  try {
    const notification = await markNotificationRead(userId, notificationId)
    return notification ? { notification } : status(404, { message: 'ไม่พบการแจ้งเตือน' })
  } catch (error) {
    console.error('Unable to mark notification as read', error)
    return status(500, { message: 'ไม่สามารถอัปเดตการแจ้งเตือนได้' })
  }
}

export async function readAllNotifications(userId: string) {
  try {
    await markAllNotificationsRead(userId)
    return { success: true }
  } catch (error) {
    console.error('Unable to mark all notifications as read', error)
    return status(500, { message: 'ไม่สามารถอัปเดตการแจ้งเตือนได้' })
  }
}
