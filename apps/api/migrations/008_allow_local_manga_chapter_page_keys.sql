BEGIN;

-- Local uploads retain their storage prefix so reads and cleanup select the
-- correct backend even if LOCAL_UPLOAD changes later.
ALTER TABLE manga_chapter_pages
  DROP CONSTRAINT IF EXISTS manga_chapter_pages_image_key_check;

ALTER TABLE manga_chapter_pages
  ADD CONSTRAINT manga_chapter_pages_image_key_check CHECK (
    image_key LIKE 'stories/chapters/%'
    OR image_key LIKE 'local/stories/chapters/%'
  );

COMMIT;
