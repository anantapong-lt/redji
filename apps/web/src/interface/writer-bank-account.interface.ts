export interface WriterBankAccountInput {
  account_holder_first_name: string
  account_holder_last_name: string
  bank_code: string
  account_number: string
}

export interface BankConfig {
  code: string
  name: string
  logo: string
}

export interface WriterBankAccount extends WriterBankAccountInput {
  id: string
  application_status: 'pending' | 'approve' | 'reject'
  status: 'active' | 'delete'
}
