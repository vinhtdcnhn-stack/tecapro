-- 068_tender_estimate_currency.sql
-- Gói thầu quốc tế có thể lập dự toán bằng ngoại tệ → thêm đơn vị tiền tệ + tỷ giá.
-- estimate được lưu theo NGUYÊN TỆ (giống quy ước hợp đồng): currency_code mô tả loại
-- tiền, exchange_rate là tỷ giá VNĐ/<ngoại tệ> chỉ để quy đổi hiển thị/tổng hợp báo cáo.
-- VND: currency_code='VND', exchange_rate=1. Áp bằng tay qua psql (local + VPS).
-- KHÔNG chạy lại schema.sql.

BEGIN;

ALTER TABLE tender
  ADD COLUMN IF NOT EXISTS currency_code varchar(10)   NOT NULL DEFAULT 'VND',
  ADD COLUMN IF NOT EXISTS exchange_rate numeric(20,6);

COMMIT;
