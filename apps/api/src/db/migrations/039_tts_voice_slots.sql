-- 039_tts_voice_slots.sql
-- One approved episode is rendered once for each stable reader-facing voice
-- slot.  The slot ID is intentionally separate from the source reference WAV
-- so the TTS machine can replace a voice without changing reader URLs/UI.

ALTER TABLE tts_jobs
  ADD COLUMN IF NOT EXISTS voice_slot TEXT NOT NULL DEFAULT 'old_male'
    CHECK (voice_slot IN ('old_male', 'young_male', 'female')),
  ADD COLUMN IF NOT EXISTS voice_profile_version TEXT NOT NULL DEFAULT 'legacy';

-- One slot may be in progress at a time for an episode.  The previous index
-- enforced one active job per episode, which prevents the required 3 voices.
DROP INDEX IF EXISTS uq_tts_jobs_active_episode;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tts_jobs_active_episode_voice
  ON tts_jobs(ep_id, voice_slot)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_tts_jobs_episode_source_voice_done
  ON tts_jobs(ep_id, source_hash, voice_slot, completed_at DESC)
  WHERE status = 'done';
