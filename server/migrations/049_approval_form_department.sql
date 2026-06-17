-- 049_approval_form_department.sql
-- Giới hạn loại đơn theo PHÒNG BAN sử dụng.
-- Admin cấu hình 0..n phòng ban được phép dùng một loại đơn (template).
--   • KHÔNG có dòng nào  → loại đơn áp dụng cho MỌI phòng ban (mặc định, tương thích cũ).
--   • Có dòng           → chỉ nhân sự thuộc các phòng ban này mới tạo được đơn loại đó.
-- Áp bằng tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS approval_form_department (
  id            bigserial PRIMARY KEY,
  form_id       bigint  NOT NULL REFERENCES approval_form(id) ON DELETE CASCADE,
  department_id integer NOT NULL REFERENCES department(id),
  UNIQUE (form_id, department_id)
);
CREATE INDEX IF NOT EXISTS idx_afd_form ON approval_form_department(form_id);

COMMIT;
