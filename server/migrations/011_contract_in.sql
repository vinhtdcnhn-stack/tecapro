CREATE TABLE IF NOT EXISTS contract_in (
  id              BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  contract_out_id BIGINT NOT NULL REFERENCES contract_out(id) ON DELETE CASCADE,
  contract_no     VARCHAR(100),
  goods_type      VARCHAR(500),
  contract_date   DATE,
  supplier_id     BIGINT REFERENCES supplier(id) ON DELETE SET NULL,
  amount          NUMERIC(20, 2) DEFAULT 0,
  currency_code   VARCHAR(10) DEFAULT 'VND',
  exchange_rate   NUMERIC(18, 4),
  purchase_type   VARCHAR(50) DEFAULT 'Trong nước',
  status          VARCHAR(50) DEFAULT 'Active',
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_in_out ON contract_in(contract_out_id);
CREATE INDEX IF NOT EXISTS idx_contract_in_supplier ON contract_in(supplier_id);
