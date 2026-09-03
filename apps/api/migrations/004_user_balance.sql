BEGIN;

ALTER TABLE users
  ADD COLUMN balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  ADD CONSTRAINT users_balance_non_negative_check CHECK (balance >= 0);

INSERT INTO schema_migrations (version) VALUES ('004_user_balance');

COMMIT;
