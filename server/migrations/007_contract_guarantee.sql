CREATE TABLE IF NOT EXISTS contract_guarantee (
  id               SERIAL PRIMARY KEY,
  contract_out_id  INTEGER NOT NULL REFERENCES contract_out(id) ON DELETE CASCADE,
  guarantee_type   VARCHAR(200),
  amount           NUMERIC(20, 2) DEFAULT 0,
  issue_date       DATE,
  expiry_date      DATE,
  status           VARCHAR(50) DEFAULT 'Còn hiệu lực',
  note             TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
