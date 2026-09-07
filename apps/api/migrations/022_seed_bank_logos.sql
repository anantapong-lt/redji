BEGIN;

INSERT INTO website_configs (key, value, description)
VALUES (
  'banks',
  '[
    {"code":"BBL","name":"ธนาคารกรุงเทพ","logo":"assets/banks/bbl.svg"},
    {"code":"KBANK","name":"ธนาคารกสิกรไทย","logo":"assets/banks/kbank.svg"},
    {"code":"KTB","name":"ธนาคารกรุงไทย","logo":"assets/banks/ktb.svg"},
    {"code":"BAY","name":"ธนาคารกรุงศรีอยุธยา","logo":"assets/banks/bay.svg"},
    {"code":"SCB","name":"ธนาคารไทยพาณิชย์","logo":"assets/banks/scb.svg"},
    {"code":"TTB","name":"ธนาคารทหารไทยธนชาต","logo":"assets/banks/ttb.svg"},
    {"code":"GSB","name":"ธนาคารออมสิน","logo":"assets/banks/gsb.svg"},
    {"code":"BAAC","name":"ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร","logo":"assets/banks/baac.svg"},
    {"code":"GHB","name":"ธนาคารอาคารสงเคราะห์","logo":"assets/banks/ghb.svg"},
    {"code":"CIMBT","name":"ธนาคารซีไอเอ็มบี ไทย","logo":"assets/banks/cimbt.svg"},
    {"code":"UOBT","name":"ธนาคารยูโอบี","logo":"assets/banks/uobt.svg"},
    {"code":"KKP","name":"ธนาคารเกียรตินาคินภัทร","logo":"assets/banks/kkp.svg"},
    {"code":"TISCO","name":"ธนาคารทิสโก้","logo":"assets/banks/tisco.svg"}
  ]'::JSONB,
  'รายการธนาคารและโลโก้สำหรับบัญชีนักเขียน'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();

INSERT INTO schema_migrations (version) VALUES ('022_seed_bank_logos');

COMMIT;
