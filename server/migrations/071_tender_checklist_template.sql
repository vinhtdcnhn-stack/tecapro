-- 071_tender_checklist_template.sql
-- Module Đấu thầu — Mẫu checklist công việc dùng chung (1 bộ mặc định).
-- Các gói thầu thường có cùng bộ đầu việc; quản lý 1 bộ mẫu rồi "Áp dụng mẫu"
-- để đổ toàn bộ vào checklist của gói, sau đó thêm/bớt + giao người.
-- Mẫu chỉ giữ tiêu đề / mô tả / phòng ban mặc định; KHÔNG có người phụ trách & hạn
-- (giao theo từng gói). Hỗ trợ việc con (parent_item_id).
-- Áp tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS tender_checklist_template_item (
  id              bigserial PRIMARY KEY,
  title           varchar(500) NOT NULL,
  description     text,
  department_id   integer      REFERENCES department(id),   -- phòng ban mặc định
  parent_item_id  bigint       REFERENCES tender_checklist_template_item(id) ON DELETE CASCADE,
  sort_order      integer      DEFAULT 0,
  created_by      integer      REFERENCES app_user(id),
  created_at      timestamptz  DEFAULT now(),
  updated_at      timestamptz  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tctt_parent ON tender_checklist_template_item(parent_item_id);

COMMIT;
