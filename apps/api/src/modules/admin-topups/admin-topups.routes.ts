import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import { getAdminTopups } from './admin-topups.controller'
import { adminTopupsQuerySchema } from './admin-topups.schema'

export const adminTopupsRoutes = new Elysia({ prefix: '/admin/topups' })
  .use(authMiddleware)
  .get('/', ({ query }) => getAdminTopups(query), {
    auth: USER_ROLE.SUPER_ADMIN,
    query: adminTopupsQuerySchema,
  })
