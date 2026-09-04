BEGIN;

CREATE TABLE email_registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(320) NOT NULL,
  username VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  verification_token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX email_registration_requests_email_unique_idx
  ON email_registration_requests (LOWER(email));
CREATE UNIQUE INDEX email_registration_requests_username_unique_idx
  ON email_registration_requests (LOWER(username));
CREATE UNIQUE INDEX email_registration_requests_token_unique_idx
  ON email_registration_requests (verification_token_hash);
CREATE INDEX email_registration_requests_expires_at_idx
  ON email_registration_requests (expires_at);

INSERT INTO schema_migrations (version) VALUES ('013_email_registration_requests');

COMMIT;
