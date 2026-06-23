-- 067_tender_investor_customer.sql
-- Chủ đầu tư của gói thầu lấy từ CSDL hệ thống (bảng customer) thay vì gõ tay.
-- Thêm FK tender.customer_id → customer(id). Cột text tender.investor giữ lại làm
-- bản chụp tên (snapshot) để hiển thị/xuất báo cáo và tương thích dữ liệu cũ.
-- Áp bằng tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

ALTER TABLE tender
  ADD COLUMN IF NOT EXISTS customer_id bigint REFERENCES customer(id);

CREATE INDEX IF NOT EXISTS idx_tender_customer ON tender(customer_id);

COMMIT;
