-- Lịch phải trả theo ĐKTT hợp đồng nhập
CREATE TABLE IF NOT EXISTS contract_in_payable (
  id              SERIAL PRIMARY KEY,
  contract_in_id  BIGINT NOT NULL REFERENCES contract_in(id) ON DELETE CASCADE,
  description     VARCHAR(500) DEFAULT '',
  payment_method  VARCHAR(100) DEFAULT 'TT',
  currency_code   VARCHAR(10)  DEFAULT 'VND',
  amount          NUMERIC(20,4) DEFAULT 0,
  exchange_rate   NUMERIC(18,4) DEFAULT 1,
  amount_vnd      NUMERIC(20,2) DEFAULT 0,
  due_date        DATE,
  delay_reason    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Thanh toán thực tế cho NCC
CREATE TABLE IF NOT EXISTS contract_in_payment (
  id              SERIAL PRIMARY KEY,
  contract_in_id  BIGINT NOT NULL REFERENCES contract_in(id) ON DELETE CASCADE,
  payment_date    DATE,
  currency_code   VARCHAR(10)  DEFAULT 'VND',
  amount          NUMERIC(20,4) DEFAULT 0,
  exchange_rate   NUMERIC(18,4) DEFAULT 1,
  amount_vnd      NUMERIC(20,2) DEFAULT 0,
  payment_ratio   NUMERIC(6,2),
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payable_contract  ON contract_in_payable(contract_in_id);
CREATE INDEX IF NOT EXISTS idx_payment_contract  ON contract_in_payment(contract_in_id);
