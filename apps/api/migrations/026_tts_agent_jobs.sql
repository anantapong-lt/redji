BEGIN;

CREATE TYPE tts_job_status AS ENUM ('queued', 'processing', 'done', 'failed', 'cancelled');

CREATE TABLE tts_agent_login_limits (
  key_hash CHAR(64) PRIMARY KEY,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tts_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_hash CHAR(64) NOT NULL,
  voice_slot VARCHAR(32) NOT NULL DEFAULT 'female'
    CHECK (voice_slot IN ('old_male', 'young_male', 'female')),
  status tts_job_status NOT NULL DEFAULT 'queued',
  worker_id UUID,
  lease_expires_at TIMESTAMPTZ,
  completed_blocks INTEGER NOT NULL DEFAULT 0 CHECK (completed_blocks >= 0),
  total_blocks INTEGER,
  audio_key TEXT,
  audio_url TEXT,
  duration_seconds NUMERIC(12, 3),
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tts_jobs_progress_check CHECK (total_blocks IS NULL OR completed_blocks <= total_blocks)
);

CREATE INDEX tts_jobs_writer_status_created_idx ON tts_jobs (requested_by, status, created_at DESC);
CREATE INDEX tts_jobs_processing_lease_idx ON tts_jobs (lease_expires_at) WHERE status = 'processing';
CREATE UNIQUE INDEX tts_jobs_one_active_render_idx
  ON tts_jobs (requested_by, chapter_id, source_hash, voice_slot)
  WHERE status IN ('queued', 'processing');

INSERT INTO schema_migrations (version) VALUES ('026_tts_agent_jobs');

COMMIT;
