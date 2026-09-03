-- 040_tts_recovery_and_chunk_manifest.sql
-- Operational recovery data is append-only, while the block manifest gives a
-- future repair UI a stable, revision-safe target without exposing it yet.

ALTER TABLE tts_jobs
  ADD COLUMN IF NOT EXISTS failure_code TEXT,
  ADD COLUMN IF NOT EXISTS failure_stage TEXT,
  ADD COLUMN IF NOT EXISTS retryable BOOLEAN,
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS tts_job_events (
  id          BIGSERIAL PRIMARY KEY,
  job_id      BIGINT NOT NULL REFERENCES tts_jobs(id) ON DELETE CASCADE,
  request_id  BIGINT REFERENCES tts_requests(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL CHECK (event_type IN (
    'claimed', 'lease_reclaimed', 'retry_scheduled', 'failed', 'completed',
    'cancelled', 'manual_retry', 'manual_cancel', 'cleanup_failed'
  )),
  severity    TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error')),
  code        TEXT,
  message     TEXT NOT NULL,
  context     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tts_job_events_request_created
  ON tts_job_events(request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tts_job_events_job_created
  ON tts_job_events(job_id, created_at DESC);

-- This records each original reader block independently of the final MP3. It
-- is intentionally ready for a later "repair one chunk" workflow: the UI can
-- target the block by ID and a repair worker can render only that source hash.
CREATE TABLE IF NOT EXISTS tts_job_blocks (
  id                BIGSERIAL PRIMARY KEY,
  job_id            BIGINT NOT NULL REFERENCES tts_jobs(id) ON DELETE CASCADE,
  block_id          TEXT NOT NULL,
  block_index       INTEGER NOT NULL CHECK (block_index >= 0),
  source_text_hash  CHAR(64) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'done', 'failed', 'skipped', 'cancelled')),
  duration_seconds  DOUBLE PRECISION CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  start_seconds     DOUBLE PRECISION CHECK (start_seconds IS NULL OR start_seconds >= 0),
  end_seconds       DOUBLE PRECISION CHECK (end_seconds IS NULL OR end_seconds >= 0),
  error_code        TEXT,
  error_message     TEXT,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_seconds IS NULL OR start_seconds IS NULL OR end_seconds >= start_seconds),
  UNIQUE(job_id, block_id),
  UNIQUE(job_id, block_index)
);

CREATE INDEX IF NOT EXISTS idx_tts_job_blocks_job_status
  ON tts_job_blocks(job_id, status, block_index);

