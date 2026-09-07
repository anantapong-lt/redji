import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import { getWriterBankAccount, submitWriterBankAccount } from './writer-bank-account.controller'
import { createWriterBankAccountBodySchema } from './writer-bank-account.schema'

export const writerBankAccountRoutes = new Elysia({ prefix: '/writer' })
  .use(authMiddleware)
  .get('/bank-account', ({ currentUser }) => getWriterBankAccount(currentUser.id), { auth: true })
  .post(
    '/bank-account',
    ({ currentUser, body }) => submitWriterBankAccount(currentUser.id, body),
    { auth: USER_ROLE.USER, body: createWriterBankAccountBodySchema },
  )
