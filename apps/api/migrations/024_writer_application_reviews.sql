BEGIN;

ALTER TABLE writer_bank_accounts
  ADD COLUMN reviewed_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN reviewed_at TIMESTAMPTZ,
  ADD COLUMN review_note TEXT;

ALTER TABLE writer_bank_accounts
  ADD CONSTRAINT writer_bank_accounts_application_review_check CHECK (
    (application_status = 'pending' AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL AND review_note IS NULL)
    OR (application_status = 'approve' AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
    OR (application_status = 'reject' AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND btrim(COALESCE(review_note, '')) <> '')
  );

INSERT INTO schema_migrations (version) VALUES ('024_writer_application_reviews');

COMMIT;
