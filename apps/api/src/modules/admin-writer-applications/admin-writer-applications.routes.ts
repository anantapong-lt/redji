import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import { getAdminWriterApplications, updateAdminWriterApplication } from './admin-writer-applications.controller'
import { adminWriterApplicationActionBodySchema, adminWriterApplicationParamsSchema, adminWriterApplicationsQuerySchema } from './admin-writer-applications.schema'

export const adminWriterApplicationRoutes = new Elysia({ prefix: '/admin/writer-applications' })
  .use(authMiddleware)
  .get('/', ({ query }) => getAdminWriterApplications(query), {
    auth: USER_ROLE.SUPER_ADMIN,
    query: adminWriterApplicationsQuerySchema,
  })
  .put('/:id', ({ currentUser, params, body }) => updateAdminWriterApplication(params.id, currentUser.id, body), {
    auth: USER_ROLE.SUPER_ADMIN,
    params: adminWriterApplicationParamsSchema,
    body: adminWriterApplicationActionBodySchema,
  })
