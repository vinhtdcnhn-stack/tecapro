-- 065_tender_checklist.sql
-- Module Đấu thầu — GĐ2: Checklist công việc + đính kèm sản phẩm + file tổng hợp hồ sơ.
-- Mỗi đầu việc giao cho 1 phòng ban + 1 người phụ trách (lấy từ HR), có file sản phẩm.
-- Đầu việc có thể có việc con (parent_item_id). Áp tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

-- ── Đầu việc trong checklist của gói thầu ────────────────────────────────────
CREATE TABLE IF NOT EXISTS tender_checklist_item (
  id              bigserial PRIMARY KEY,
  tender_id       bigint       NOT NULL REFERENCES tender(id) ON DELETE CASCADE,
  title           varchar(500) NOT NULL,
  description     text,
  department_id   integer      REFERENCES department(id),   -- phòng ban chuyên môn
  assignee_id     integer      REFERENCES app_user(id),     -- người phụ trách (HR)
  due_date        date,
  status          varchar(30)  NOT NULL DEFAULT 'Chờ xử lý', -- 'Chờ xử lý'|'Đang thực hiện'|'Hoàn thành'|'Hủy'
  parent_item_id  bigint       REFERENCES tender_checklist_item(id) ON DELETE CASCADE,
  sort_order      integer      DEFAULT 0,
  completed_at    timestamptz,
  created_by      integer      NOT NULL REFERENCES app_user(id),
  created_at      timestamptz  DEFAULT now(),
  updated_at      timestamptz  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tci_tender   ON tender_checklist_item(tender_id);
CREATE INDEX IF NOT EXISTS idx_tci_parent   ON tender_checklist_item(parent_item_id);
CREATE INDEX IF NOT EXISTS idx_tci_assignee ON tender_checklist_item(assignee_id);

-- ── Tệp sản phẩm của đầu việc (mirror dept_work_task_attachment) ──────────────
CREATE TABLE IF NOT EXISTS tender_checklist_attachment (
  id          bigserial PRIMARY KEY,
  item_id     bigint       NOT NULL REFERENCES tender_checklist_item(id) ON DELETE CASCADE,
  file_name   varchar(255) NOT NULL,
  file_path   varchar(500) NOT NULL,   -- '/uploads/tender/{tenderId}/items/{itemId}/{ts}_{safe}'
  file_size   bigint,
  mime_type   varchar(150),
  uploaded_by integer      REFERENCES app_user(id),
  created_at  timestamptz  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tca_item ON tender_checklist_attachment(item_id);

-- ── File tổng hợp hồ sơ của gói (bản đơn giản; versioning đầy đủ để GĐ3) ──────
CREATE TABLE IF NOT EXISTS tender_summary_file (
  id          bigserial PRIMARY KEY,
  tender_id   bigint       NOT NULL REFERENCES tender(id) ON DELETE CASCADE,
  file_name   varchar(255) NOT NULL,
  file_path   varchar(500) NOT NULL,   -- '/uploads/tender/{tenderId}/summary/{ts}_{safe}'
  file_size   bigint,
  mime_type   varchar(150),
  uploaded_by integer      REFERENCES app_user(id),
  created_at  timestamptz  DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tsf_tender ON tender_summary_file(tender_id);

COMMIT;
