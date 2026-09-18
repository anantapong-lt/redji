BEGIN;

ALTER TABLE phone_verification_requests
  RENAME COLUMN provider_token TO otp_hash;

COMMIT;
