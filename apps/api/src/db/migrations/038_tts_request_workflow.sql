-- 038_tts_request_workflow.sql
-- A TTS request is a work-level approval record; tts_jobs remain episode-level
-- execution records and are created only after approval or an enabled auto-update.

CREATE TABLE IF NOT EXISTS tts_requests (
  id                  BIGSERIAL PRIMARY KEY,
  p_id                BIGINT NOT NULL REFERENCES works(p_id) ON DELETE CASCADE,
  requested_by        BIGINT REFERENCES users(id) ON DELETE SET NULL,
  requester_type      TEXT NOT NULL CHECK (requester_type IN ('writer', 'reader', 'admin', 'system_update')),
  tier                TEXT NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic', 'pro')),
  status              TEXT NOT NULL DEFAULT 'approval' CHECK (status IN ('approval', 'queued', 'processing', 'completed', 'failed', 'cancelled', 'rejected')),
  source_episode_id   BIGINT REFERENCES work_ep(ep_id) ON DELETE SET NULL,
  auto_update         BOOLEAN NOT NULL DEFAULT FALSE,
  priority            INTEGER NOT NULL DEFAULT 0,
  approved_by         BIGINT REFERENCES users(id) ON DELETE SET NULL,
  rejection_reason    TEXT,
  requested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at         TIMESTAMPTZ,
  queued_at           TIMESTAMPTZ,
  started_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tts_request_episodes (
  request_id          BIGINT NOT NULL REFERENCES tts_requests(id) ON DELETE CASCADE,
  ep_id               BIGINT NOT NULL REFERENCES work_ep(ep_id) ON DELETE CASCADE,
  PRIMARY KEY (request_id, ep_id)
);

-- An approved work keeps automatic narration enabled for future published episodes.
CREATE TABLE IF NOT EXISTS tts_work_access (
  p_id                BIGINT PRIMARY KEY REFERENCES works(p_id) ON DELETE CASCADE,
  tier                TEXT NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic', 'pro')),
  auto_update         BOOLEAN NOT NULL DEFAULT TRUE,
  enabled_by          BIGINT REFERENCES users(id) ON DELETE SET NULL,
  enabled_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tts_worker_heartbeats (
  worker_id           TEXT PRIMARY KEY,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_job_id      BIGINT REFERENCES tts_jobs(id) ON DELETE SET NULL
);

ALTER TABLE tts_jobs
  ADD COLUMN IF NOT EXISTS request_id BIGINT REFERENCES tts_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tts_requests_status_priority
  ON tts_requests(status, priority DESC, requested_at ASC);

CREATE INDEX IF NOT EXISTS idx_tts_request_episodes_episode
  ON tts_request_episodes(ep_id);

CREATE INDEX IF NOT EXISTS idx_tts_jobs_request
  ON tts_jobs(request_id, requested_at ASC);

DROP INDEX IF EXISTS idx_tts_jobs_pending_available;
CREATE INDEX idx_tts_jobs_pending_available
  ON tts_jobs(priority DESC, available_at ASC, requested_at ASC)
  WHERE status = 'pending';
