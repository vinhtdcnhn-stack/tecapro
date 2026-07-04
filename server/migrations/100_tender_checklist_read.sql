-- 100_tender_checklist_read.sql
-- Mốc ĐÃ ĐỌC dòng thời gian ĐẦU VIỆC đấu thầu (song song contract_task_read và
-- dept_work_task_read). Nhờ bảng này, đầu việc đấu thầu mới có khái niệm "chưa đọc":
-- badge/cảnh báo + nền hổ phách dashboard hoạt động như việc HĐ / việc phòng.
-- Áp bằng tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS tender_checklist_read (
  item_id      bigint      NOT NULL REFERENCES tender_checklist_item(id) ON DELETE CASCADE,
  user_id      integer     NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, user_id)
);

COMMIT;
