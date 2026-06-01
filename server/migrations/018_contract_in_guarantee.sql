CREATE TABLE IF NOT EXISTS contract_in_guarantee (
  id              SERIAL PRIMARY KEY,
  contract_in_id  BIGINT NOT NULL REFERENCES contract_in(id) ON DELETE CASCADE,
  guarantee_type  VARCHAR(200) DEFAULT 'Bảo lãnh thanh toán',
  amount          NUMERIC(20, 2) DEFAULT 0,
  issue_date      DATE,
  expiry_date     DATE,
  status          VARCHAR(50) DEFAULT 'Còn hiệu lực',
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_in_guarantee_contract ON contract_in_guarantee(contract_in_id);
