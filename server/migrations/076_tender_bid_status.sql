-- 076_tender_bid_status.sql
-- Module Đấu thầu — thêm trường "Trạng thái" làm thầu (độc lập với workflow_status):
--   'Đang làm thầu' (mặc định) | 'Đã nộp thầu'.
-- Phản ánh tiến độ nộp hồ sơ, do người làm thầu/Trưởng phòng cập nhật ngay trên form.
-- Áp tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

ALTER TABLE tender
  ADD COLUMN IF NOT EXISTS bid_status text NOT NULL DEFAULT 'Đang làm thầu';

COMMIT;
