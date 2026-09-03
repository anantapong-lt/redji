BEGIN;

ALTER TABLE chapters
  ADD COLUMN price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  ADD CONSTRAINT chapters_price_non_negative_check CHECK (price >= 0);

CREATE TABLE chapter_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  writer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE RESTRICT,
  price NUMERIC(12, 2) NOT NULL,
  writer_revenue NUMERIC(12, 2) NOT NULL,
  platform_revenue NUMERIC(12, 2) NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chapter_purchases_buyer_chapter_unique UNIQUE (buyer_user_id, chapter_id),
  CONSTRAINT chapter_purchases_price_positive_check CHECK (price > 0),
  CONSTRAINT chapter_purchases_writer_revenue_non_negative_check CHECK (writer_revenue >= 0),
  CONSTRAINT chapter_purchases_platform_revenue_non_negative_check CHECK (platform_revenue >= 0),
  CONSTRAINT chapter_purchases_revenue_total_check
    CHECK (writer_revenue + platform_revenue = price),
  CONSTRAINT chapter_purchases_buyer_writer_check CHECK (buyer_user_id <> writer_user_id)
);

CREATE INDEX chapter_purchases_chapter_id_idx ON chapter_purchases (chapter_id);
CREATE INDEX chapter_purchases_writer_user_id_idx
  ON chapter_purchases (writer_user_id, purchased_at DESC);

INSERT INTO schema_migrations (version) VALUES ('008_chapter_purchases');

COMMIT;
