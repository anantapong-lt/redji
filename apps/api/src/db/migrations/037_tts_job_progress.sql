-- 037_tts_job_progress.sql
-- Keep progress at the same granularity as the chapter blocks so writers can
-- distinguish an active render from a stalled worker and cancel safely.

ALTER TABLE tts_jobs
  ADD COLUMN IF NOT EXISTS total_blocks INTEGER NOT NULL DEFAULT 0
    CHECK (total_blocks >= 0),
  ADD COLUMN IF NOT EXISTS completed_blocks INTEGER NOT NULL DEFAULT 0
    CHECK (completed_blocks >= 0 AND completed_blocks <= total_blocks),
  ADD COLUMN IF NOT EXISTS current_block INTEGER
    CHECK (current_block IS NULL OR (current_block >= 1 AND current_block <= total_blocks)),
  ADD COLUMN IF NOT EXISTS progress_updated_at TIMESTAMPTZ;
