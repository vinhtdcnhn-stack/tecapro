CREATE TABLE IF NOT EXISTS contract_in_boq (
  id                SERIAL PRIMARY KEY,
  contract_in_id    BIGINT NOT NULL REFERENCES contract_in(id) ON DELETE CASCADE,
  sort_order        INTEGER DEFAULT 0,
  item_name         VARCHAR(1000) NOT NULL DEFAULT '',
  unit              VARCHAR(100)  DEFAULT '',
  quantity          NUMERIC(20,4) DEFAULT 0,
  unit_price        NUMERIC(20,4) DEFAULT 0,
  amount_before_vat NUMERIC(20,2) DEFAULT 0,
  vat_rate          NUMERIC(6,2)  DEFAULT 0,
  amount_after_vat  NUMERIC(20,2) DEFAULT 0,
  warranty_period   VARCHAR(200)  DEFAULT '',
  created_at        TIMESTAMPTZ   DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_in_boq_contract ON contract_in_boq(contract_in_id);
