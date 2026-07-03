-- 095_contract_task_entry_image.sql
-- Ảnh đính kèm cho từng mục trong DÒNG THỜI GIAN của công việc hợp đồng
-- (contract_task_entry): cho phép dán/tải ảnh vào báo cáo/chỉ đạo/trao đổi và
-- hiển thị ảnh ngay trong dòng thời gian.
-- Áp bằng tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS contract_task_entry_image (
  id         bigserial   PRIMARY KEY,
  entry_id   bigint      NOT NULL REFERENCES contract_task_entry(id) ON DELETE CASCADE,
  file_name  text        NOT NULL,
  file_path  text        NOT NULL,
  file_size  integer,
  mime_type  varchar(100),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ctei_entry ON contract_task_entry_image(entry_id);

COMMIT;
