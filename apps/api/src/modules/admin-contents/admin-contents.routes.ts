import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import { changeAdminContentStatus, getAdminContents } from './admin-contents.controller'
import { adminContentParamsSchema, adminContentsQuerySchema, adminContentStatusBodySchema } from './admin-contents.schema'

export const adminContentsRoutes = new Elysia({ prefix: '/admin/contents' })
  .use(authMiddleware)
  .get('/', ({ query }) => getAdminContents(query), {
    auth: USER_ROLE.SUPER_ADMIN,
    query: adminContentsQuerySchema,
  })
  .put('/:id/status', ({ params, body }) => changeAdminContentStatus(params.id, body), {
    auth: USER_ROLE.SUPER_ADMIN,
    params: adminContentParamsSchema,
    body: adminContentStatusBodySchema,
  })
