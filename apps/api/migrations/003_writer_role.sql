BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum
    INNER JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
    WHERE pg_type.typname = 'user_role'
      AND pg_enum.enumlabel = 'admin'
  ) THEN
    ALTER TYPE user_role RENAME VALUE 'admin' TO 'writer';
  END IF;
END;
$$;

INSERT INTO schema_migrations (version) VALUES ('003_writer_role');

COMMIT;
