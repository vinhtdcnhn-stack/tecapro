-- Bảo hành NCC theo từng chủng loại hàng (link tới đợt nhận để lấy serials)
CREATE TABLE IF NOT EXISTS contract_in_supplier_warranty (
  id                   SERIAL PRIMARY KEY,
  contract_in_id       BIGINT NOT NULL REFERENCES contract_in(id) ON DELETE CASCADE,
  delivery_item_id     INTEGER REFERENCES contract_in_delivery_item(id) ON DELETE SET NULL,
  item_name            VARCHAR(500) NOT NULL DEFAULT '',
  warranty_period_text VARCHAR(200) DEFAULT '',
  warranty_start       DATE,
  warranty_end         DATE,
  has_guarantee        BOOLEAN DEFAULT FALSE,
  note                 TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Claim bảo hành với NCC
CREATE TABLE IF NOT EXISTS contract_in_warranty_claim (
  id              SERIAL PRIMARY KEY,
  contract_in_id  BIGINT NOT NULL REFERENCES contract_in(id) ON DELETE CASCADE,
  warranty_id     INTEGER REFERENCES contract_in_supplier_warranty(id) ON DELETE SET NULL,
  claim_no        VARCHAR(100),
  title           VARCHAR(500) NOT NULL,
  description     TEXT,
  reported_date   DATE DEFAULT CURRENT_DATE,
  status          VARCHAR(50) DEFAULT 'Tiếp nhận',
  resolved_date   DATE,
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sup_warranty_contract  ON contract_in_supplier_warranty(contract_in_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claim_contract ON contract_in_warranty_claim(contract_in_id);
