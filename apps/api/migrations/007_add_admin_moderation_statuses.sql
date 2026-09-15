BEGIN;

CREATE TYPE moderation_status AS ENUM ('active', 'hidden', 'suspended');

ALTER TABLE users
  ADD COLUMN writer_status moderation_status NOT NULL DEFAULT 'active';

ALTER TABLE stories
  ADD COLUMN moderation_status moderation_status NOT NULL DEFAULT 'active';

-- Existing banned writers remain unable to authenticate and are represented by
-- the new writer-facing suspension state.
UPDATE users
SET writer_status = 'suspended'
WHERE role = 'writer' AND status = 'banned';

-- Before this migration an admin "hide" was stored as a story soft delete.
-- Admin moderation is now suspension; only the owner may choose hidden.
UPDATE stories
SET moderation_status = 'suspended', deleted_at = NULL
WHERE deleted_at IS NOT NULL;

CREATE INDEX users_writer_status_idx ON users (writer_status) WHERE role = 'writer';
CREATE INDEX stories_moderation_status_idx ON stories (moderation_status);

COMMIT;
