BEGIN;

ALTER TABLE chapter_purchases
  ADD COLUMN writer_commission_percent NUMERIC,
  ADD CONSTRAINT chapter_purchases_commission_percent_check
    CHECK (writer_commission_percent BETWEEN 0 AND 100);

UPDATE chapter_purchases
SET writer_commission_percent = 15
WHERE writer_commission_percent IS NULL;

ALTER TABLE chapter_purchases
  ALTER COLUMN writer_commission_percent SET NOT NULL;

COMMENT ON COLUMN chapter_purchases.writer_commission_percent IS
  'Platform deduction percentage at purchase time; historical purchases backfilled with 15 percent';

INSERT INTO schema_migrations (version) VALUES ('016_chapter_purchase_commission');

COMMIT;
