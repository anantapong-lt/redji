import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { getNotifications, getUnreadNotificationCount, readNotification } from './notifications.controller'
import { notificationParamsSchema, notificationsQuerySchema } from './notifications.schema'

export const notificationRoutes = new Elysia({ prefix: '/notifications' })
  .use(authMiddleware)
  .get('/', ({ currentUser, query }) => getNotifications(currentUser.id, query), {
    auth: true,
    query: notificationsQuerySchema,
  })
  .get('/unread-count', ({ currentUser }) => getUnreadNotificationCount(currentUser.id), { auth: true })
  .patch('/:id/read', ({ currentUser, params }) => readNotification(currentUser.id, params.id), {
    auth: true,
    params: notificationParamsSchema,
  })
