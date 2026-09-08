import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import { createWriterWithdrawalResponse, getWriterWithdrawalsResponse } from './writer-withdrawals.controller'
import { createWriterWithdrawalBodySchema, writerWithdrawalQuerySchema } from './writer-withdrawals.schema'

export const writerWithdrawalRoutes = new Elysia({ prefix: '/writer/withdrawals' })
  .use(authMiddleware)
  .get('/', ({ currentUser, query }) => getWriterWithdrawalsResponse(currentUser.id, query), {
    auth: USER_ROLE.WRITER,
    query: writerWithdrawalQuerySchema,
  })
  .post('/', ({ currentUser, body }) => createWriterWithdrawalResponse(currentUser.id, body), {
    auth: USER_ROLE.WRITER,
    body: createWriterWithdrawalBodySchema,
  })
