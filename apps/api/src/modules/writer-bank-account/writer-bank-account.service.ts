import { db } from '../../db'

export interface WriterBankAccount {
  id: string
  account_holder_first_name: string
  account_holder_last_name: string
  bank_code: string
  account_number: string
  application_status: 'pending' | 'approve' | 'reject'
  status: 'active' | 'delete'
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
      ${input.account_number}, 'pending', 'active'
    )
    ON CONFLICT (writer_user_id) DO UPDATE SET
      account_holder_first_name = EXCLUDED.account_holder_first_name,
      account_holder_last_name = EXCLUDED.account_holder_last_name,
      bank_code = EXCLUDED.bank_code,
      account_number = EXCLUDED.account_number,
      application_status = 'pending',
      status = 'active',
      updated_at = NOW()
    RETURNING id, account_holder_first_name, account_holder_last_name, bank_code,
      account_number, application_status, status
  `
  return account
}
