BEGIN;

CREATE TABLE writer_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  writer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_holder_first_name VARCHAR(100) NOT NULL,
  account_holder_last_name VARCHAR(100) NOT NULL,
  bank_code VARCHAR(20) NOT NULL,
  account_number VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT writer_bank_accounts_writer_unique UNIQUE (writer_user_id),
  CONSTRAINT writer_bank_accounts_holder_first_name_check CHECK (btrim(account_holder_first_name) <> ''),
  CONSTRAINT writer_bank_accounts_holder_last_name_check CHECK (btrim(account_holder_last_name) <> ''),
  CONSTRAINT writer_bank_accounts_bank_code_check CHECK (btrim(bank_code) <> ''),
  CONSTRAINT writer_bank_accounts_account_number_check CHECK (account_number ~ '^[0-9]{8,20}$')
);

INSERT INTO schema_migrations (version) VALUES ('017_writer_bank_accounts');

COMMIT;
