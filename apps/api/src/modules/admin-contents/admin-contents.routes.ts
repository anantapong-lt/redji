import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import { getAdminContents } from './admin-contents.controller'
import { adminContentsQuerySchema } from './admin-contents.schema'

export const adminContentsRoutes = new Elysia({ prefix: '/admin/contents' })
  .use(authMiddleware)
  .get('/', ({ query }) => getAdminContents(query), {
    auth: USER_ROLE.SUPER_ADMIN,
    query: adminContentsQuerySchema,
  })
