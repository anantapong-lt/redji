import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import {
  authorizeTopupSocket,
  closeTopupSocket,
  createUserTopup,
  getUserTopup,
  getUserTopupHistory,
  openTopupSocket,
  receiveTmweasyWebhook,
} from './topup.controller'
import {
  createTopupBodySchema,
  topupHistoryQuerySchema,
  tmweasyWebhookBodySchema,
  topupParamsSchema,
} from './topup.schema'

export const topupRoutes = new Elysia({ prefix: '/topups' })
  .use(authMiddleware)
  .post(
    '',
    ({ body, currentUser, request }) => createUserTopup(
      currentUser.id,
      body.amount,
      request,
    ),
    { auth: true, body: createTopupBodySchema },
  )
  .get(
    '',
    ({ currentUser, query }) => getUserTopupHistory(currentUser.id, query),
    { auth: true, query: topupHistoryQuerySchema },
  )
  .post(
    '/tmweasy/webhook',
    ({ body }) => receiveTmweasyWebhook(body.data, body.signature),
    { body: tmweasyWebhookBodySchema },
  )
  .ws('/:id/events', {
    params: topupParamsSchema,
    optionalAuth: true,
    beforeHandle: ({ currentUser, params, request }) => authorizeTopupSocket(
      currentUser?.id,
      params.id,
      request.headers.get('origin'),
    ),
    open: (socket) => void openTopupSocket(
      socket,
      socket.data.currentUser!.id,
      socket.data.params.id,
    ),
    close: (socket) => closeTopupSocket(socket.id),
  })
  .get(
    '/:id',
    ({ currentUser, params }) => getUserTopup(currentUser.id, params.id),
    { auth: true, params: topupParamsSchema },
  )
