import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import { getAdminPurchases, getAdminPurchaseStories, getAdminPurchaseUsers, getAdminPurchaseWriters } from './admin-purchases.controller'
import { adminPurchaseStoriesQuerySchema, adminPurchaseUsersQuerySchema, adminPurchaseWritersQuerySchema, adminPurchasesQuerySchema } from './admin-purchases.schema'

export const adminPurchasesRoutes = new Elysia({ prefix: '/admin/purchases' })
  .use(authMiddleware)
  .get('/stories', ({ query }) => getAdminPurchaseStories(query), {
    auth: USER_ROLE.SUPER_ADMIN,
    query: adminPurchaseStoriesQuerySchema,
  })
  .get('/users', ({ query }) => getAdminPurchaseUsers(query), {
    auth: USER_ROLE.SUPER_ADMIN,
    query: adminPurchaseUsersQuerySchema,
  })
  .get('/writers', ({ query }) => getAdminPurchaseWriters(query), {
    auth: USER_ROLE.SUPER_ADMIN,
    query: adminPurchaseWritersQuerySchema,
  })
  .get('/', ({ query }) => getAdminPurchases(query), {
    auth: USER_ROLE.SUPER_ADMIN,
    query: adminPurchasesQuerySchema,
  })
