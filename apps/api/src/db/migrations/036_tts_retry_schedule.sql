-- 036_tts_retry_schedule.sql
-- A failed render is retried with a backoff window instead of hot-looping the GPU.
-- available_at is also used by workers to safely reclaim an expired lease.

ALTER TABLE tts_jobs
  ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_tts_jobs_pending_available
  ON tts_jobs(available_at, requested_at)
  WHERE status = 'pending';
