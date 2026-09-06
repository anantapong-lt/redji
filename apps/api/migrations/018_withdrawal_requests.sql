BEGIN;

CREATE TYPE withdrawal_request_status AS ENUM ('pending', 'approved', 'paid', 'rejected');

CREATE TABLE withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  writer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  account_holder_first_name VARCHAR(100) NOT NULL,
  account_holder_last_name VARCHAR(100) NOT NULL,
  bank_code VARCHAR(20) NOT NULL,
  account_number VARCHAR(32) NOT NULL,
  requested_amount NUMERIC(12, 2) NOT NULL,
  commission_percent NUMERIC(5, 2) NOT NULL,
  commission_amount NUMERIC(12, 2) NOT NULL,
  net_amount NUMERIC(12, 2) NOT NULL,
  status withdrawal_request_status NOT NULL DEFAULT 'pending',
  approval_note TEXT,
  rejection_reason TEXT,
  transfer_proof_key TEXT,
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT withdrawal_requests_holder_first_name_check CHECK (btrim(account_holder_first_name) <> ''),
  CONSTRAINT withdrawal_requests_holder_last_name_check CHECK (btrim(account_holder_last_name) <> ''),
  CONSTRAINT withdrawal_requests_bank_code_check CHECK (btrim(bank_code) <> ''),
  CONSTRAINT withdrawal_requests_account_number_check CHECK (account_number ~ '^[0-9]{8,20}$'),
  CONSTRAINT withdrawal_requests_requested_amount_check CHECK (requested_amount > 0),
  CONSTRAINT withdrawal_requests_commission_percent_check CHECK (commission_percent >= 0 AND commission_percent <= 100),
  CONSTRAINT withdrawal_requests_commission_amount_check CHECK (commission_amount >= 0),
  CONSTRAINT withdrawal_requests_net_amount_check CHECK (net_amount > 0),
  CONSTRAINT withdrawal_requests_amounts_check CHECK (net_amount = requested_amount - commission_amount),
  CONSTRAINT withdrawal_requests_status_timestamps_check CHECK (
    (status = 'pending' AND approved_at IS NULL AND paid_at IS NULL AND rejected_at IS NULL)
    OR (status = 'approved' AND approved_at IS NOT NULL AND paid_at IS NULL AND rejected_at IS NULL)
    OR (status = 'paid' AND approved_at IS NOT NULL AND paid_at IS NOT NULL AND rejected_at IS NULL)
    OR (status = 'rejected' AND approved_at IS NULL AND paid_at IS NULL AND rejected_at IS NOT NULL)
  )
);

CREATE INDEX withdrawal_requests_writer_requested_at_idx
  ON withdrawal_requests (writer_user_id, requested_at DESC);
CREATE INDEX withdrawal_requests_status_requested_at_idx
  ON withdrawal_requests (status, requested_at DESC);

CREATE TABLE withdrawal_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_request_id UUID NOT NULL REFERENCES withdrawal_requests(id) ON DELETE CASCADE,
  from_status withdrawal_request_status,
  to_status withdrawal_request_status NOT NULL,
  note TEXT,
  actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX withdrawal_request_events_request_created_at_idx
  ON withdrawal_request_events (withdrawal_request_id, created_at DESC);

INSERT INTO schema_migrations (version) VALUES ('018_withdrawal_requests');

COMMIT;
