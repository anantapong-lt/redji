BEGIN;

INSERT INTO website_configs (key, value, description)
VALUES
  ('site', '{"name":"Readji","tagline":"","description":"","site_url":"http://localhost:3000","admin_url":"http://localhost:3002","coin_name":"เหรียญ"}'::JSONB, 'ข้อมูลเว็บไซต์'),
  ('topup', '{"packages":[{"amount":"50","bonus":"0"},{"amount":"100","bonus":"0"},{"amount":"300","bonus":"0"},{"amount":"500","bonus":"0"},{"amount":"1000","bonus":"0"},{"amount":"3000","bonus":"0"}]}'::JSONB, 'แพ็กเกจเติมเงิน'),
  ('withdrawal', '{"commission_percent":"10"}'::JSONB, 'ค่าคอมมิชชันถอนเงิน'),
  ('features', '{"registration":true,"writer_application":true,"comments":true,"topup":true,"withdrawals":false}'::JSONB, 'สถานะการเปิดใช้งานฟีเจอร์')
ON CONFLICT (key) DO NOTHING;

INSERT INTO schema_migrations (version) VALUES ('016_seed_website_configs');

COMMIT;
