BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'phone_verification_requests' AND column_name = 'otp_hash'
  ) THEN
    ALTER TABLE phone_verification_requests RENAME COLUMN otp_hash TO provider_token;
  END IF;
END $$;

COMMIT;
