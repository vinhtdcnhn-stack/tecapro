-- Đợt nhận hàng (batch header)
CREATE TABLE IF NOT EXISTS contract_in_delivery (
  id             SERIAL PRIMARY KEY,
  contract_in_id BIGINT NOT NULL REFERENCES contract_in(id) ON DELETE CASCADE,
  batch_name     VARCHAR(200),
  receive_date   DATE,
  warehouse      VARCHAR(500),
  status         VARCHAR(50) DEFAULT 'Chờ nhận',
  note           TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Danh mục hàng trong từng đợt (link tới BOQ)
CREATE TABLE IF NOT EXISTS contract_in_delivery_item (
  id               SERIAL PRIMARY KEY,
  delivery_id      INTEGER NOT NULL REFERENCES contract_in_delivery(id) ON DELETE CASCADE,
  boq_item_id      INTEGER REFERENCES contract_in_boq(id) ON DELETE SET NULL,
  item_name        VARCHAR(1000) NOT NULL DEFAULT '',
  unit             VARCHAR(100)  DEFAULT '',
  ordered_quantity NUMERIC(20,4) DEFAULT 0,
  received_quantity NUMERIC(20,4) DEFAULT 0,
  note             TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Serial của từng loại hàng trong đợt
CREATE TABLE IF NOT EXISTS contract_in_delivery_serial (
  id               SERIAL PRIMARY KEY,
  delivery_item_id INTEGER NOT NULL REFERENCES contract_in_delivery_item(id) ON DELETE CASCADE,
  serial_no        VARCHAR(200) NOT NULL,
  note             TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_contract    ON contract_in_delivery(contract_in_id);
CREATE INDEX IF NOT EXISTS idx_delivery_item_batch  ON contract_in_delivery_item(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_serial_item ON contract_in_delivery_serial(delivery_item_id);
