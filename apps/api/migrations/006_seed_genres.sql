BEGIN;

INSERT INTO genres (name, slug)
VALUES
  ('โรแมนติก', 'romantic'),
  ('โรแมนซ์แฟนตาซี', 'romance-fantasy'),
  ('BL/GL', 'bl-gl'),
  ('แฟนตาซี', 'fantasy'),
  ('แอ็กชัน', 'action'),
  ('สยองขวัญ', 'horror'),
  ('ดราม่า', 'drama'),
  ('ศิลปะการต่อสู้', 'martial-arts')
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('006_seed_genres');

COMMIT;
