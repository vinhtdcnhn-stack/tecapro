CREATE TABLE IF NOT EXISTS contract_task_attachment (
  id           SERIAL PRIMARY KEY,
  task_id      INTEGER NOT NULL REFERENCES contract_task(id) ON DELETE CASCADE,
  file_name    VARCHAR(500) NOT NULL,
  file_path    TEXT NOT NULL,
  file_size    BIGINT,
  mime_type    VARCHAR(200),
  uploaded_by  INTEGER,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_attachment_task ON contract_task_attachment(task_id);
