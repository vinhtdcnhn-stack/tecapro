-- 050_approval_request_soft_delete.sql
-- Xóa MỀM đề xuất (admin). Có tình huống tạo sai và đã phê duyệt; nếu xóa cứng sẽ
-- mất dấu vết. Thay vì xóa hẳn, đánh dấu đã xóa + lưu người xóa, thời điểm, lý do.
-- Đơn bị xóa vẫn hiển thị (gạch ngang) để tránh nhầm lẫn, kèm lịch sử xóa.
-- Áp bằng tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

ALTER TABLE approval_request
  ADD COLUMN IF NOT EXISTS deleted_at     timestamp without time zone,
  ADD COLUMN IF NOT EXISTS deleted_by     integer REFERENCES app_user(id),
  ADD COLUMN IF NOT EXISTS deleted_reason text;

CREATE INDEX IF NOT EXISTS idx_areq_deleted ON approval_request(deleted_at);

COMMIT;
