import { db } from '../../db'
import { WRITER_APPLICATION_STATUS, type WriterApplicationStatus } from '../../models/writer-application.model'

export interface WriterBankAccount {
  id: string
  account_holder_first_name: string
  account_holder_last_name: string
  bank_code: string
  account_number: string
  application_status: WriterApplicationStatus
  status: 'active' | 'delete'
}

export interface BankConfig {
  code: string
  name: string
  logo: string
}

export async function findBankConfigs(): Promise<BankConfig[]> {
  const [row] = await db<{ value: BankConfig[] }[]>`
    SELECT value
    FROM website_configs
    WHERE key = 'banks'
  `
  return Array.isArray(row?.value) ? row.value : []
}

export async function findWriterBankAccount(userId: string) {
  const [account] = await db<WriterBankAccount[]>`
    SELECT id, account_holder_first_name, account_holder_last_name, bank_code,
      account_number, application_status, status
    FROM writer_bank_accounts
    WHERE writer_user_id = ${userId} AND status = 'active'
    LIMIT 1
  `
  return account ?? null
}

export async function upsertWriterBankAccount(
  userId: string,
  input: Omit<WriterBankAccount, 'id' | 'application_status' | 'status'>,
) {
  const [account] = await db<WriterBankAccount[]>`
    INSERT INTO writer_bank_accounts (
      writer_user_id, account_holder_first_name, account_holder_last_name,
      bank_code, account_number, application_status, status
    ) VALUES (
      ${userId}, ${input.account_holder_first_name.trim()},
      ${input.account_holder_last_name.trim()}, ${input.bank_code.trim()},
      ${input.account_number}, ${WRITER_APPLICATION_STATUS.PENDING}, 'active'
    )
    ON CONFLICT (writer_user_id) DO UPDATE SET
      account_holder_first_name = EXCLUDED.account_holder_first_name,
      account_holder_last_name = EXCLUDED.account_holder_last_name,
      bank_code = EXCLUDED.bank_code,
      account_number = EXCLUDED.account_number,
      application_status = ${WRITER_APPLICATION_STATUS.PENDING},
      status = 'active',
      reviewed_by_user_id = NULL,
      reviewed_at = NULL,
      review_note = NULL,
      updated_at = NOW()
    RETURNING id, account_holder_first_name, account_holder_last_name, bank_code,
      account_number, application_status, status
  `
  return account
}
