import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import { getAdminContents, hideAdminContent, restoreAdminContent } from './admin-contents.controller'
import { adminContentParamsSchema, adminContentsQuerySchema, hideAdminContentBodySchema } from './admin-contents.schema'

export const adminContentsRoutes = new Elysia({ prefix: '/admin/contents' })
  .use(authMiddleware)
  .get('/', ({ query }) => getAdminContents(query), {
    auth: USER_ROLE.SUPER_ADMIN,
    query: adminContentsQuerySchema,
  })
  .delete('/:id', ({ params, body }) => hideAdminContent(params.id, body), {
    auth: USER_ROLE.SUPER_ADMIN,
    params: adminContentParamsSchema,
    body: hideAdminContentBodySchema,
  })
  .put('/:id/restore', ({ params }) => restoreAdminContent(params.id), {
    auth: USER_ROLE.SUPER_ADMIN,
    params: adminContentParamsSchema,
  })
