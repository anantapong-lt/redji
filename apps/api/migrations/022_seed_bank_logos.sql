BEGIN;

INSERT INTO website_configs (key, value, description)
VALUES (
  'banks',
  '[
    {"code":"BBL","name":"ธนาคารกรุงเทพ","logo":"assets/banks/bbl.png"},
    {"code":"KBANK","name":"ธนาคารกสิกรไทย","logo":"assets/banks/kbank.png"},
    {"code":"KTB","name":"ธนาคารกรุงไทย","logo":"assets/banks/ktb.png"},
    {"code":"BAY","name":"ธนาคารกรุงศรีอยุธยา","logo":"assets/banks/bay.png"},
    {"code":"SCB","name":"ธนาคารไทยพาณิชย์","logo":"assets/banks/scb.png"},
    {"code":"TTB","name":"ธนาคารทหารไทยธนชาต","logo":"assets/banks/ttb.png"},
    {"code":"GSB","name":"ธนาคารออมสิน","logo":"assets/banks/gsb.png"},
    {"code":"BAAC","name":"ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร","logo":"assets/banks/baac.png"},
    {"code":"GHB","name":"ธนาคารอาคารสงเคราะห์","logo":"assets/banks/ghb.png"},
    {"code":"CIMBT","name":"ธนาคารซีไอเอ็มบี ไทย","logo":"assets/banks/cimbt.png"},
    {"code":"UOBT","name":"ธนาคารยูโอบี","logo":"assets/banks/uobt.png"},
    {"code":"KKP","name":"ธนาคารเกียรตินาคินภัทร","logo":"assets/banks/kkp.png"},
    {"code":"TISCO","name":"ธนาคารทิสโก้","logo":"assets/banks/tisco.png"}
  ]'::JSONB,
  'รายการธนาคารและโลโก้สำหรับบัญชีนักเขียน'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();

INSERT INTO schema_migrations (version) VALUES ('022_seed_bank_logos')
ON CONFLICT (version) DO NOTHING;

COMMIT;
