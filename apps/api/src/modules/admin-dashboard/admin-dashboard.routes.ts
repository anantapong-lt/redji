import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import { loadAdminDashboard } from './admin-dashboard.controller'
import { adminDashboardQuerySchema } from './admin-dashboard.schema'

export const adminDashboardRoutes = new Elysia({ prefix: '/admin/dashboard' })
  .use(authMiddleware)
  .get('/', ({ query }) => loadAdminDashboard(query), {
    auth: USER_ROLE.SUPER_ADMIN,
    query: adminDashboardQuerySchema,
  })
