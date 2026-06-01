CREATE TABLE IF NOT EXISTS contract_in_progress (
  id              SERIAL PRIMARY KEY,
  contract_in_id  BIGINT NOT NULL REFERENCES contract_in(id) ON DELETE CASCADE,
  bb_type_id      INTEGER REFERENCES contract_bb_type(id) ON DELETE SET NULL,
  sort_order      INTEGER DEFAULT 0,
  planned_date    DATE,
  actual_date     DATE,
  reason          TEXT DEFAULT '',
  penalty_note    TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_in_progress_contract ON contract_in_progress(contract_in_id);
