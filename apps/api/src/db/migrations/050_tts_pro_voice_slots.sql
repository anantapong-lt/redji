-- Manual Tier 1 Pro narration.
-- Slot 0 is narrator; slots 1-6 are reusable character voice slots.

ALTER TABLE tts_jobs
  DROP CONSTRAINT IF EXISTS tts_jobs_voice_slot_check;

ALTER TABLE tts_jobs
  ADD CONSTRAINT tts_jobs_voice_slot_check
  CHECK (voice_slot IN ('old_male', 'young_male', 'female', 'pro'));

ALTER TABLE tts_jobs
  ADD COLUMN IF NOT EXISTS voice_assignments JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS voice_assignment_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_tts_jobs_episode_source_pro_done
  ON tts_jobs(ep_id, source_hash, voice_assignment_hash, completed_at DESC)
  WHERE status = 'done' AND voice_slot = 'pro';

ALTER TABLE tts_work_character_labels
  DROP CONSTRAINT IF EXISTS tts_work_character_labels_slot_no_check,
  DROP CONSTRAINT IF EXISTS tts_work_character_labels_p_id_shortcut_key;

ALTER TABLE tts_work_character_labels
  ADD CONSTRAINT tts_work_character_labels_slot_no_check
  CHECK (slot_no BETWEEN 0 AND 6);

CREATE TABLE IF NOT EXISTS tts_work_character_shortcuts (
  id          BIGSERIAL PRIMARY KEY,
  p_id        BIGINT NOT NULL REFERENCES works(p_id) ON DELETE CASCADE,
  label_id    BIGINT NOT NULL REFERENCES tts_work_character_labels(id) ON DELETE CASCADE,
  shortcut    TEXT NOT NULL CHECK (shortcut ~ '^[A-Za-z][A-Za-z0-9_-]{0,30}$'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (p_id, shortcut),
  UNIQUE (label_id, shortcut)
);

CREATE INDEX IF NOT EXISTS idx_tts_character_shortcuts_work
  ON tts_work_character_shortcuts(p_id, shortcut);

-- Preserve aliases previously stored on the parent before making it optional.
INSERT INTO tts_work_character_shortcuts (p_id, label_id, shortcut)
SELECT p_id, id, shortcut
FROM tts_work_character_labels
WHERE shortcut IS NOT NULL AND shortcut <> ''
ON CONFLICT DO NOTHING;

ALTER TABLE tts_work_character_labels
  ALTER COLUMN shortcut DROP NOT NULL;
