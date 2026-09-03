import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import { getWriterStats } from './writer.service'

export const writerRoutes = new Elysia({ prefix: '/writer' })
  .use(authMiddleware)
  .get(
    '/stats',
    async ({ currentUser }) => ({ stats: await getWriterStats(currentUser.id) }),
    { auth: USER_ROLE.WRITER },
  )
