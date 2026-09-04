import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import {
  createUserTopup,
  getUserTopup,
  receiveTmweasyWebhook,
} from './topup.controller'
import {
  createTopupBodySchema,
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
  .post(
    '/tmweasy/webhook',
    ({ body }) => receiveTmweasyWebhook(body.data, body.signature),
    { body: tmweasyWebhookBodySchema },
  )
  .get(
    '/:id',
    ({ currentUser, params }) => getUserTopup(currentUser.id, params.id),
    { auth: true, params: topupParamsSchema },
  )
