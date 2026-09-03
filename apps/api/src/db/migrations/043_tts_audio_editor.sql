-- 043_tts_audio_editor.sql
-- Writer-side, revision-safe TTS chunk editing. The published novel keeps
-- reader text in work_ep.ep_content; TTS-only directives live alongside it
-- in the same JSON block and never appear in the reader UI.

ALTER TABLE tts_requests
  DROP CONSTRAINT IF EXISTS tts_requests_requester_type_check;

ALTER TABLE tts_requests
  ADD CONSTRAINT tts_requests_requester_type_check
  CHECK (requester_type IN ('writer', 'reader', 'admin', 'system_update', 'writer_edit'));

-- A draft is a deliberately small, per-episode snapshot. Two explicit slots
-- make storage predictable and avoid turning every keystroke into a durable
-- version-history feature.
CREATE TABLE IF NOT EXISTS tts_episode_edit_saves (
  id          BIGSERIAL PRIMARY KEY,
  ep_id       BIGINT NOT NULL REFERENCES work_ep(ep_id) ON DELETE CASCADE,
  author_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_no     SMALLINT NOT NULL CHECK (slot_no IN (1, 2)),
  name        TEXT NOT NULL DEFAULT '',
  payload     JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ep_id, slot_no)
);

CREATE INDEX IF NOT EXISTS idx_tts_episode_edit_saves_author
  ON tts_episode_edit_saves(author_id, updated_at DESC);

-- Six work-level character labels are enough for the first narration engine.
-- Their shortcut is alpha-numeric without the leading //; //1-//20 remain
-- reserved for core commands and can never collide with a character.
CREATE TABLE IF NOT EXISTS tts_work_character_labels (
  id            BIGSERIAL PRIMARY KEY,
  p_id          BIGINT NOT NULL REFERENCES works(p_id) ON DELETE CASCADE,
  slot_no       SMALLINT NOT NULL CHECK (slot_no BETWEEN 1 AND 6),
  shortcut      TEXT NOT NULL CHECK (shortcut ~ '^[A-Za-z][A-Za-z0-9_-]{0,30}$'),
  display_name  TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 80),
  voice_role    TEXT NOT NULL CHECK (voice_role IN ('lead', 'supporting', 'extra')),
  gender        TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  color         TEXT NOT NULL DEFAULT '#7c3aed' CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (p_id, slot_no),
  UNIQUE (p_id, shortcut)
);

CREATE INDEX IF NOT EXISTS idx_tts_character_labels_work
  ON tts_work_character_labels(p_id, slot_no);
