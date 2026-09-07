BEGIN;

ALTER TABLE writer_bank_accounts
  ADD COLUMN application_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';

ALTER TABLE writer_bank_accounts
  ADD CONSTRAINT writer_bank_accounts_application_status_check
    CHECK (application_status IN ('pending', 'approve', 'reject')),
  ADD CONSTRAINT writer_bank_accounts_status_check
    CHECK (status IN ('active', 'delete'));

INSERT INTO schema_migrations (version) VALUES ('019_writer_bank_account_statuses');

COMMIT;
