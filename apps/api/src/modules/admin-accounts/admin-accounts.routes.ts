import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import { createAdminAccount, getAdminAccounts } from './admin-accounts.controller'
import { adminAccountsQuerySchema, createAdminAccountBodySchema } from './admin-accounts.schema'

export const adminAccountsRoutes = new Elysia({ prefix: '/admin/accounts' })
  .use(authMiddleware)
  .get('/', ({ query }) => getAdminAccounts(query), {
    auth: USER_ROLE.SUPER_ADMIN,
    query: adminAccountsQuerySchema,
  })
  .post('/', ({ body }) => createAdminAccount(body), {
    auth: USER_ROLE.SUPER_ADMIN,
    body: createAdminAccountBodySchema,
  })
