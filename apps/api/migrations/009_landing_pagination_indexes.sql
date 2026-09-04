BEGIN;

CREATE INDEX stories_public_popular_idx
  ON stories (total_views DESC, id DESC)
  WHERE status IN ('ongoing', 'completed') AND deleted_at IS NULL;

CREATE INDEX chapters_story_published_at_idx
  ON chapters (story_id, published_at DESC, id DESC)
  WHERE status = 'published';

INSERT INTO schema_migrations (version) VALUES ('009_landing_pagination_indexes');

COMMIT;
