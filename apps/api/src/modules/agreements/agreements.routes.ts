import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import {
  activateAdminAgreement,
  getActiveAgreement,
  getAdminAgreements,
  postAdminAgreement,
  updateAdminAgreementStatus,
} from './agreements.controller'
import {
  agreementIdParamsSchema,
  agreementTypeParamsSchema,
  createAgreementBodySchema,
  updateAgreementStatusBodySchema,
} from './agreements.schema'

export const agreementsRoutes = new Elysia()
  .get('/agreements/:type', ({ params }) => getActiveAgreement(params), { params: agreementTypeParamsSchema })
  .group('/admin/agreements', (app) => app
    .use(authMiddleware)
    .get('/:type', ({ params }) => getAdminAgreements(params), { auth: USER_ROLE.SUPER_ADMIN, params: agreementTypeParamsSchema })
    .post('/:type', ({ params, body }) => postAdminAgreement(params, body), { auth: USER_ROLE.SUPER_ADMIN, params: agreementTypeParamsSchema, body: createAgreementBodySchema })
    .put('/:type/:id/status', ({ params, body }) => updateAdminAgreementStatus(params, body), { auth: USER_ROLE.SUPER_ADMIN, params: agreementIdParamsSchema, body: updateAgreementStatusBodySchema })
    .put('/:type/:id/activate', ({ params }) => activateAdminAgreement(params), { auth: USER_ROLE.SUPER_ADMIN, params: agreementIdParamsSchema }),
  )
