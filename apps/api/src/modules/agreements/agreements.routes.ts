import { Elysia, t } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import { activateAgreement, createAgreement, findActiveAgreement, findAgreements, type AgreementType } from './agreements.service'

const typeSchema = t.Union([t.Literal('website'), t.Literal('writer')])
const paramsSchema = t.Object({ type: typeSchema })

export const agreementsRoutes = new Elysia()
  .get('/agreements/:type', async ({ params }) => ({ agreement: await findActiveAgreement(params.type) }), { params: paramsSchema })
  .group('/admin/agreements', (app) => app
    .use(authMiddleware)
    .get('/:type', async ({ params }) => ({ agreements: await findAgreements(params.type) }), { auth: USER_ROLE.SUPER_ADMIN, params: paramsSchema })
    .post('/:type', async ({ params, body }) => ({ agreement: await createAgreement(params.type, body.content_html.trim()) }), { auth: USER_ROLE.SUPER_ADMIN, params: paramsSchema, body: t.Object({ content_html: t.String({ minLength: 1 }) }) })
    .put('/:type/:id/activate', async ({ params, set }) => {
      const active = await activateAgreement(params.type as AgreementType, params.id)
      if (!active) { set.status = 404; return { message: 'ไม่พบข้อตกลง' } }
      return { message: 'เปิดใช้งานข้อตกลงเรียบร้อยแล้ว' }
    }, { auth: USER_ROLE.SUPER_ADMIN, params: t.Object({ type: typeSchema, id: t.String({ format: 'uuid' }) }) }),
  )
