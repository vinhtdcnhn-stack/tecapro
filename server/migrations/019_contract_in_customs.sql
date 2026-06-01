CREATE TABLE IF NOT EXISTS contract_in_customs (
  id                SERIAL PRIMARY KEY,
  contract_in_id    BIGINT NOT NULL REFERENCES contract_in(id) ON DELETE CASCADE,
  shipment_type     VARCHAR(20)   DEFAULT 'Nhập khẩu',
  declaration_no    VARCHAR(100),
  declaration_date  DATE,
  bl_awb_no         VARCHAR(200),
  etd               DATE,
  eta               DATE,
  port_of_loading   VARCHAR(200),
  port_of_discharge VARCHAR(200),
  customs_status    VARCHAR(100)  DEFAULT 'Chưa khai báo',
  shipping_cost     NUMERIC(20,2) DEFAULT 0,
  tax_amount        NUMERIC(20,2) DEFAULT 0,
  other_fees        NUMERIC(20,2) DEFAULT 0,
  note              TEXT,
  created_at        TIMESTAMPTZ   DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_in_customs_contract ON contract_in_customs(contract_in_id);
