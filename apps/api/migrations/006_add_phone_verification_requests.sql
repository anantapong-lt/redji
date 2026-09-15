BEGIN;

CREATE TABLE phone_verification_requests (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  phone_number VARCHAR(16) NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT phone_verification_requests_phone_format_check
    CHECK (phone_number ~ '^\+66[689][0-9]{8}$')
);

CREATE INDEX phone_verification_requests_expires_at_idx
  ON phone_verification_requests (expires_at);

COMMIT;
