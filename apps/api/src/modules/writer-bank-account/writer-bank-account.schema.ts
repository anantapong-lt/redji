import { t } from 'elysia'

export const createWriterBankAccountBodySchema = t.Object({
  account_holder_first_name: t.String({ minLength: 1, maxLength: 100 }),
  account_holder_last_name: t.String({ minLength: 1, maxLength: 100 }),
  bank_code: t.String({ minLength: 1, maxLength: 20 }),
  account_number: t.String({ pattern: '^[0-9]{8,20}$' }),
})
