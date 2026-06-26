-- 083_dept_work_timeline.sql
-- Dòng thời gian trao đổi cho công việc phòng (department 7): mỗi việc có một luồng
-- theo thời gian gồm Báo cáo / Chỉ đạo / Quyết định / Trao đổi. Thay cho panel "Vấn đề"
-- (open/resolved) cũ — dữ liệu cũ được di trú thành mục 'report'.
-- Kèm mốc "đã đọc" của từng người cho từng việc để bảng việc nhấp nháy mục chưa đọc.
-- Áp bằng tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

-- ── Mục trong dòng thời gian của việc ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dept_work_entry (
  id          bigserial   PRIMARY KEY,
  task_id     bigint      NOT NULL REFERENCES dept_work_task(id) ON DELETE CASCADE,
  entry_type  varchar(20) NOT NULL DEFAULT 'discussion', -- 'report'|'directive'|'decision'|'discussion'
  content     text        NOT NULL,
  author_id   integer     NOT NULL REFERENCES app_user(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dwe_task ON dept_work_entry(task_id, created_at);

-- ── Mốc đã đọc của mỗi người cho mỗi việc (để cảnh báo "chưa đọc") ────────────
CREATE TABLE IF NOT EXISTS dept_work_task_read (
  task_id      bigint      NOT NULL REFERENCES dept_work_task(id) ON DELETE CASCADE,
  user_id      integer     NOT NULL REFERENCES app_user(id),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

-- ── Di trú "Vấn đề" cũ vào dòng thời gian (giữ nguyên tác giả + thời điểm) ─────
INSERT INTO dept_work_entry (task_id, entry_type, content, author_id, created_at, updated_at)
SELECT task_id, 'report', content, reported_by, created_at, updated_at
  FROM dept_work_issue;

COMMIT;
