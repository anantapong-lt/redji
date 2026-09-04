BEGIN;

ALTER TABLE chapter_purchases
  DROP CONSTRAINT chapter_purchases_buyer_writer_check;

INSERT INTO schema_migrations (version)
VALUES ('012_allow_owner_chapter_purchases');

COMMIT;
