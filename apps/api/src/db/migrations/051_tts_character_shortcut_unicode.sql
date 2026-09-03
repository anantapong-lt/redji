-- Character aliases are writer-facing names and must support Thai as well as
-- ASCII. Application validation still requires a Unicode letter first and
-- limits the rest to letters, numbers, _ and -. The DB check is deliberately
-- broad enough for Unicode across PostgreSQL locale configurations while
-- still excluding whitespace and directive slashes.

ALTER TABLE tts_work_character_shortcuts
  DROP CONSTRAINT IF EXISTS tts_work_character_shortcuts_shortcut_check;

ALTER TABLE tts_work_character_shortcuts
  ADD CONSTRAINT tts_work_character_shortcuts_shortcut_check
  CHECK (shortcut ~ '^[^[:space:]/]{1,31}$');
