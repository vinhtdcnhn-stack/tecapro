-- 096_dept_work_entry_image.sql
-- Ảnh đính kèm cho từng mục trong DÒNG THỜI GIAN của công việc phòng
-- (dept_work_entry): cho phép dán/tải ảnh vào báo cáo/chỉ đạo/trao đổi và hiển
-- thị ảnh ngay trong dòng thời gian. Song song contract_task_entry_image (095).
-- Áp bằng tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS dept_work_entry_image (
  id         bigserial   PRIMARY KEY,
  entry_id   bigint      NOT NULL REFERENCES dept_work_entry(id) ON DELETE CASCADE,
  file_name  text        NOT NULL,
  file_path  text        NOT NULL,
  file_size  integer,
  mime_type  varchar(100),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dwei_entry ON dept_work_entry_image(entry_id);

COMMIT;
