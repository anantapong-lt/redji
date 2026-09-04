BEGIN;

CREATE TYPE topup_transaction_status AS ENUM (
  'pending',
  'paid',
  'expired',
  'failed'
);

CREATE TABLE topup_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider VARCHAR(32) NOT NULL,
  provider_payment_id VARCHAR(100),
  requested_amount NUMERIC(12, 2) NOT NULL,
  amount_check_satang BIGINT,
  base_coins NUMERIC(12, 2) NOT NULL,
  bonus_coins NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  credited_coins NUMERIC(12, 2) NOT NULL,
  status topup_transaction_status NOT NULL DEFAULT 'pending',
  provider_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  expires_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT topup_transactions_provider_payment_unique
    UNIQUE (provider, provider_payment_id),
  CONSTRAINT topup_transactions_requested_amount_positive_check
    CHECK (requested_amount > 0),
  CONSTRAINT topup_transactions_amount_check_satang_positive_check
    CHECK (amount_check_satang IS NULL OR amount_check_satang > 0),
  CONSTRAINT topup_transactions_base_coins_positive_check
    CHECK (base_coins > 0),
  CONSTRAINT topup_transactions_bonus_coins_non_negative_check
    CHECK (bonus_coins >= 0),
  CONSTRAINT topup_transactions_credited_coins_check
    CHECK (credited_coins = base_coins + bonus_coins),
  CONSTRAINT topup_transactions_paid_at_check
    CHECK (
      (status = 'paid' AND paid_at IS NOT NULL)
      OR (status <> 'paid' AND paid_at IS NULL)
    )
);

CREATE INDEX topup_transactions_user_created_at_idx
  ON topup_transactions (user_id, created_at DESC);

CREATE INDEX topup_transactions_pending_expires_at_idx
  ON topup_transactions (expires_at)
  WHERE status = 'pending';

INSERT INTO schema_migrations (version) VALUES ('012_topup_transactions');

COMMIT;
