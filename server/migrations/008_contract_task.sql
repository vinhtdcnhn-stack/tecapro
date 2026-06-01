CREATE TABLE IF NOT EXISTS contract_task (
  id               SERIAL PRIMARY KEY,
  contract_out_id  INTEGER NOT NULL REFERENCES contract_out(id) ON DELETE CASCADE,
  title            VARCHAR(500) NOT NULL,
  description      TEXT,
  department_id    INTEGER REFERENCES department(id),
  assigned_to      INTEGER REFERENCES app_user(id),
  created_by       INTEGER REFERENCES app_user(id),
  priority         VARCHAR(20)  NOT NULL DEFAULT 'Bình thường',
  due_date         DATE,
  status           VARCHAR(50)  NOT NULL DEFAULT 'Chờ xử lý',
  note             TEXT,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_task_contract ON contract_task(contract_out_id);
CREATE INDEX IF NOT EXISTS idx_contract_task_dept     ON contract_task(department_id);
CREATE INDEX IF NOT EXISTS idx_contract_task_assigned ON contract_task(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contract_task_status   ON contract_task(status);
