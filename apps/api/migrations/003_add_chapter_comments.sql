BEGIN;

CREATE TABLE chapter_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES chapter_comments(id) ON DELETE CASCADE,
  body VARCHAR(2000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chapter_comments_body_not_blank CHECK (LENGTH(BTRIM(body)) > 0)
);

CREATE INDEX chapter_comments_chapter_root_created_idx
  ON chapter_comments (chapter_id, created_at DESC)
  WHERE parent_comment_id IS NULL AND deleted_at IS NULL;

CREATE INDEX chapter_comments_parent_created_idx
  ON chapter_comments (parent_comment_id, created_at ASC)
  WHERE deleted_at IS NULL;

CREATE TABLE chapter_comment_reactions (
  comment_id UUID NOT NULL REFERENCES chapter_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction VARCHAR(16) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id),
  CONSTRAINT chapter_comment_reactions_reaction_check
    CHECK (reaction IN ('like', 'love', 'wow', 'haha', 'sad', 'angry'))
);

CREATE INDEX chapter_comment_reactions_comment_idx
  ON chapter_comment_reactions (comment_id);

COMMIT;
