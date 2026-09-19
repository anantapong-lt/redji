BEGIN;

ALTER TYPE moderation_status ADD VALUE IF NOT EXISTS 'locked';

COMMIT;

-- Preserve the previous meaning of a suspended story: it remains visible to
-- its creator, but is unavailable on public surfaces.
BEGIN;

UPDATE stories
SET moderation_status = 'locked'
WHERE moderation_status = 'suspended';

COMMIT;
