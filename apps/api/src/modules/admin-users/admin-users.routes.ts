import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import { getAdminUsers } from './admin-users.controller'
import { adminUsersQuerySchema } from './admin-users.schema'

export const adminUsersRoutes = new Elysia({ prefix: '/admin/users' })
  .use(authMiddleware)
  .get('/', ({ query }) => getAdminUsers(query), {
    auth: USER_ROLE.SUPER_ADMIN,
    query: adminUsersQuerySchema,
  })
