import { db } from '../../db'
import type { NotificationType } from '../../models/notification.model'

export interface UserNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  target_url: string | null
  data: Record<string, unknown>
  read_at: Date | null
  created_at: Date
}

const select = 'id, type, title, message, target_url, data, read_at, created_at'

export async function findNotifications(userId: string, page: number, limit: number) {
  const [notifications, [count]] = await Promise.all([
    db<UserNotification[]>`
      SELECT ${db.unsafe(select)}
      FROM notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `,
    db<{ total: string }[]>`
      SELECT COUNT(*)::TEXT AS total
      FROM notifications
      WHERE user_id = ${userId}
    `,
  ])
  const total = Number(count?.total ?? 0)
  return {
    notifications,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.max(1, Math.ceil(total / limit)),
    },
  }
}

export async function findUnreadNotificationCount(userId: string) {
  const [result] = await db<{ count: string }[]>`
    SELECT COUNT(*)::TEXT AS count
    FROM notifications
    WHERE user_id = ${userId} AND read_at IS NULL
  `
  return Number(result?.count ?? 0)
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const [notification] = await db<UserNotification[]>`
    UPDATE notifications
    SET read_at = COALESCE(read_at, NOW())
    WHERE id = ${notificationId} AND user_id = ${userId}
    RETURNING ${db.unsafe(select)}
  `
  return notification ?? null
}
