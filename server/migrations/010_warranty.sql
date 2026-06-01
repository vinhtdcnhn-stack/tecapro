-- Thiết bị bàn giao theo hợp đồng
CREATE TABLE IF NOT EXISTS contract_equipment (
  id              SERIAL PRIMARY KEY,
  contract_out_id INTEGER NOT NULL REFERENCES contract_out(id) ON DELETE CASCADE,
  name            VARCHAR(500) NOT NULL,
  brand           VARCHAR(200),
  model           VARCHAR(200),
  quantity        NUMERIC(10,2) DEFAULT 1,
  location        VARCHAR(500),
  warranty_from   DATE,
  warranty_to     DATE,
  has_serial      BOOLEAN DEFAULT FALSE,
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Serial của từng thiết bị
CREATE TABLE IF NOT EXISTS equipment_serial (
  id           SERIAL PRIMARY KEY,
  equipment_id INTEGER NOT NULL REFERENCES contract_equipment(id) ON DELETE CASCADE,
  serial_no    VARCHAR(200) NOT NULL,
  status       VARCHAR(50) DEFAULT 'Đang hoạt động',
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Case bảo hành (đối tượng trung tâm)
CREATE TABLE IF NOT EXISTS warranty_case (
  id              SERIAL PRIMARY KEY,
  contract_out_id INTEGER NOT NULL REFERENCES contract_out(id) ON DELETE CASCADE,
  case_no         VARCHAR(100),
  title           VARCHAR(500) NOT NULL,
  description     TEXT,
  reported_by     VARCHAR(255),
  reported_date   DATE DEFAULT CURRENT_DATE,
  priority        VARCHAR(20) DEFAULT 'Bình thường',
  status          VARCHAR(50) DEFAULT 'Tiếp nhận',
  resolved_date   DATE,
  note            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Liên kết Case ↔ Thiết bị (many-to-many)
CREATE TABLE IF NOT EXISTS warranty_case_equipment (
  id           SERIAL PRIMARY KEY,
  case_id      INTEGER NOT NULL REFERENCES warranty_case(id) ON DELETE CASCADE,
  equipment_id INTEGER NOT NULL REFERENCES contract_equipment(id) ON DELETE CASCADE,
  serial_id    INTEGER REFERENCES equipment_serial(id) ON DELETE SET NULL,
  note         TEXT
);

-- Nhật ký xử lý theo case
CREATE TABLE IF NOT EXISTS warranty_activity (
  id             SERIAL PRIMARY KEY,
  case_id        INTEGER NOT NULL REFERENCES warranty_case(id) ON DELETE CASCADE,
  activity_type  VARCHAR(100),
  description    TEXT NOT NULL,
  performed_by   VARCHAR(255),
  performed_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_equipment_contract ON contract_equipment(contract_out_id);
CREATE INDEX IF NOT EXISTS idx_equipment_serial_equipment  ON equipment_serial(equipment_id);
CREATE INDEX IF NOT EXISTS idx_warranty_case_contract      ON warranty_case(contract_out_id);
CREATE INDEX IF NOT EXISTS idx_warranty_case_equipment_case ON warranty_case_equipment(case_id);
CREATE INDEX IF NOT EXISTS idx_warranty_activity_case      ON warranty_activity(case_id);
