import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import { getAdminWriters } from './admin-writers.controller'
import { adminWritersQuerySchema } from './admin-writers.schema'

export const adminWritersRoutes = new Elysia({ prefix: '/admin/writers' })
  .use(authMiddleware)
  .get('/', ({ query }) => getAdminWriters(query), {
    auth: USER_ROLE.SUPER_ADMIN,
    query: adminWritersQuerySchema,
  })
