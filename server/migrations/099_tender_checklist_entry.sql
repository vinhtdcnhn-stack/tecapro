-- 099_tender_checklist_entry.sql
-- Dòng thời gian trao đổi cho ĐẦU VIỆC đấu thầu (tender_checklist_item): Báo cáo /
-- Chỉ đạo / Quyết định / Trao đổi theo luồng thời gian — song song contract_task_entry
-- và dept_work_entry. Mỗi mục kèm được ảnh (dán Ctrl+V hoặc chọn tệp).
-- Áp bằng tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS tender_checklist_entry (
  id          bigserial   PRIMARY KEY,
  item_id     bigint      NOT NULL REFERENCES tender_checklist_item(id) ON DELETE CASCADE,
  entry_type  varchar(20) NOT NULL DEFAULT 'discussion', -- 'report'|'directive'|'decision'|'discussion'
  content     text        NOT NULL,
  author_id   integer     NOT NULL REFERENCES app_user(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tce_item ON tender_checklist_entry(item_id, created_at);

CREATE TABLE IF NOT EXISTS tender_checklist_entry_image (
  id         bigserial   PRIMARY KEY,
  entry_id   bigint      NOT NULL REFERENCES tender_checklist_entry(id) ON DELETE CASCADE,
  file_name  text        NOT NULL,
  file_path  text        NOT NULL,
  file_size  integer,
  mime_type  varchar(100),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tcei_entry ON tender_checklist_entry_image(entry_id);

COMMIT;
