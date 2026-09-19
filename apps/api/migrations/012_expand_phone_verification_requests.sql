BEGIN;

-- The same table serves authenticated account changes and pre-registration OTPs.
ALTER TABLE phone_verification_requests
  DROP CONSTRAINT phone_verification_requests_pkey,
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN verification_token_hash CHAR(64),
  ADD COLUMN verified_at TIMESTAMPTZ,
  ADD COLUMN consumed_at TIMESTAMPTZ;

UPDATE phone_verification_requests SET id = gen_random_uuid() WHERE id IS NULL;

ALTER TABLE phone_verification_requests
  ALTER COLUMN id SET NOT NULL,
  ADD CONSTRAINT phone_verification_requests_pkey PRIMARY KEY (id),
  ADD CONSTRAINT phone_verification_requests_user_id_unique UNIQUE (user_id);

ALTER TABLE email_registration_requests
  ADD COLUMN phone_number VARCHAR(16),
  ADD COLUMN phone_verified_at TIMESTAMPTZ;

COMMIT;
