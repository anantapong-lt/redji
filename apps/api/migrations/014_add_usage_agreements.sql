CREATE TYPE usage_agreement_type AS ENUM ('website', 'writer');

CREATE TABLE usage_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type usage_agreement_type NOT NULL,
  version INTEGER NOT NULL,
  content_html TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (type, version)
);

CREATE UNIQUE INDEX usage_agreements_one_active_per_type_idx
  ON usage_agreements (type) WHERE is_active;
