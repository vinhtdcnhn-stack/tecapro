CREATE TABLE IF NOT EXISTS contract_in_logistics (
  id              SERIAL PRIMARY KEY,
  contract_in_id  BIGINT NOT NULL REFERENCES contract_in(id) ON DELETE CASCADE,
  carrier         VARCHAR(300),
  tracking_no     VARCHAR(200),
  has_insurance   BOOLEAN      DEFAULT FALSE,
  insurance_note  VARCHAR(500),
  status          VARCHAR(100) DEFAULT 'Chờ vận chuyển',
  note            TEXT,
  created_at      TIMESTAMPTZ  DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_in_logistics_update (
  id           SERIAL PRIMARY KEY,
  logistics_id INTEGER NOT NULL REFERENCES contract_in_logistics(id) ON DELETE CASCADE,
  update_time  TIMESTAMPTZ DEFAULT NOW(),
  location     VARCHAR(300),
  description  TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_in_logistics_contract ON contract_in_logistics(contract_in_id);
CREATE INDEX IF NOT EXISTS idx_logistics_update_logistics     ON contract_in_logistics_update(logistics_id);
