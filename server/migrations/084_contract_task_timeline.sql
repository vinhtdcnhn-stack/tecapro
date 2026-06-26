-- 084_contract_task_timeline.sql
-- Dòng thời gian trao đổi cho CÔNG VIỆC HỢP ĐỒNG (contract_task): mỗi việc có một luồng
-- theo thời gian gồm Báo cáo / Chỉ đạo / Quyết định / Trao đổi — song song với
-- dept_work_entry (migration 083) nhưng cho việc gắn hợp đồng.
-- Kèm mốc "đã đọc" của từng người cho từng việc để dòng việc hiện chấm chưa đọc.
-- Áp bằng tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.
-- Lưu ý: contract_task.id là INTEGER (không phải bigint).

BEGIN;

-- ── Mục trong dòng thời gian của việc ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contract_task_entry (
  id          bigserial   PRIMARY KEY,
  task_id     integer     NOT NULL REFERENCES contract_task(id) ON DELETE CASCADE,
  entry_type  varchar(20) NOT NULL DEFAULT 'discussion', -- 'report'|'directive'|'decision'|'discussion'
  content     text        NOT NULL,
  author_id   integer     NOT NULL REFERENCES app_user(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cte_task ON contract_task_entry(task_id, created_at);

-- ── Mốc đã đọc của mỗi người cho mỗi việc (để báo "chưa đọc") ─────────────────
CREATE TABLE IF NOT EXISTS contract_task_read (
  task_id      integer     NOT NULL REFERENCES contract_task(id) ON DELETE CASCADE,
  user_id      integer     NOT NULL REFERENCES app_user(id),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

COMMIT;
