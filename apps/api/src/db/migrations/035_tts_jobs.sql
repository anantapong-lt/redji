-- 035_tts_jobs.sql
-- ระบบเสียงพากย์นิยาย: 1 job = 1 render ของ content revision หนึ่ง
-- source_hash กัน worker publish audio/timestamp ของเนื้อหาเก่าทับ revision ใหม่

CREATE TABLE IF NOT EXISTS tts_jobs (
  id                BIGSERIAL PRIMARY KEY,
  ep_id             BIGINT NOT NULL REFERENCES work_ep(ep_id),
  requested_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
  source_hash       CHAR(64) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'done', 'failed', 'cancelled')),
  voice_mode        TEXT NOT NULL DEFAULT 'single'
                    CHECK (voice_mode IN ('single', 'multi')),
  attempt_count     INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts      INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  worker_id         TEXT,
  lease_expires_at  TIMESTAMPTZ,
  audio_key         TEXT,
  audio_url         TEXT,
  duration_seconds  DOUBLE PRECISION CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  error_message     TEXT,
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (status = 'done' AND audio_key IS NOT NULL AND audio_url IS NOT NULL AND duration_seconds IS NOT NULL)
    OR status <> 'done'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tts_jobs_active_episode
  ON tts_jobs(ep_id)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_tts_jobs_pending
  ON tts_jobs(requested_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_tts_jobs_episode_requested
  ON tts_jobs(ep_id, requested_at DESC);
