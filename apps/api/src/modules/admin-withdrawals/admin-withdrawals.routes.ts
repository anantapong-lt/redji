import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import { getAdminWithdrawalProof, getAdminWithdrawals, updateAdminWithdrawal } from './admin-withdrawals.controller'
import { adminWithdrawalActionBodySchema, adminWithdrawalParamsSchema, adminWithdrawalQuerySchema } from './admin-withdrawals.schema'

export const adminWithdrawalRoutes = new Elysia({ prefix: '/admin/withdrawals' })
  .use(authMiddleware)
  .get('/', ({ query }) => getAdminWithdrawals(query), { auth: USER_ROLE.SUPER_ADMIN, query: adminWithdrawalQuerySchema })
  .put('/:id', ({ params, body, currentUser }) => updateAdminWithdrawal(params.id, currentUser.id, body), { auth: USER_ROLE.SUPER_ADMIN, params: adminWithdrawalParamsSchema, body: adminWithdrawalActionBodySchema })
  .get('/:id/proof', ({ params }) => getAdminWithdrawalProof(params.id), { auth: USER_ROLE.SUPER_ADMIN, params: adminWithdrawalParamsSchema })
