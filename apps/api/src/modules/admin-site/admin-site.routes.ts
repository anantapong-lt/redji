import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import { loadAdminSiteConfig, updateAdminSiteConfig } from './admin-site.controller'
import { adminSiteConfigBodySchema } from './admin-site.schema'

export const adminSiteRoutes = new Elysia({ prefix: '/admin/site' })
  .use(authMiddleware)
  .get('/', () => loadAdminSiteConfig(), { auth: USER_ROLE.SUPER_ADMIN })
  .put('/', ({ body }) => updateAdminSiteConfig(body), {
    auth: USER_ROLE.SUPER_ADMIN,
    body: adminSiteConfigBodySchema,
  })
