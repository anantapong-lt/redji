import { Elysia } from 'elysia'
import { authMiddleware } from '../../middleware/auth.middleware'
import { USER_ROLE } from '../../models/user.model'
import { getBankConfigs, getWriterApplicationStatus, getWriterBankAccount, submitWriterBankAccount } from './writer-bank-account.controller'
import { createWriterBankAccountBodySchema } from './writer-bank-account.schema'
import { t } from 'elysia'

const bankLogoParamsSchema = t.Object({ filename: t.String({ pattern: '^[a-z0-9-]+\\.png$' }) })

export const writerBankAccountRoutes = new Elysia({ prefix: '/writer' })
  .use(authMiddleware)
  .get('/banks', () => getBankConfigs(), { auth: true })
  .get('/assets/banks/:filename', ({ params }) => Bun.file(`${import.meta.dir}/../../../assets/banks/${params.filename}`), { params: bankLogoParamsSchema })
  .get('/application-status', ({ currentUser }) => getWriterApplicationStatus(currentUser.id), { auth: USER_ROLE.USER })
  .get('/bank-account', ({ currentUser }) => getWriterBankAccount(currentUser.id), { auth: true })
  .post(
    '/bank-account',
    ({ currentUser, body }) => submitWriterBankAccount(currentUser.id, body),
    { auth: USER_ROLE.USER, body: createWriterBankAccountBodySchema },
  )
