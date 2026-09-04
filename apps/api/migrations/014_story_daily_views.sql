BEGIN;

CREATE TABLE story_daily_views (
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  view_date DATE NOT NULL,
  view_count BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (story_id, view_date),
  CONSTRAINT story_daily_views_count_check CHECK (view_count >= 0)
);

CREATE INDEX story_daily_views_weekly_ranking_idx
  ON story_daily_views (view_date, story_id)
  INCLUDE (view_count);

INSERT INTO schema_migrations (version) VALUES ('014_story_daily_views');

COMMIT;
