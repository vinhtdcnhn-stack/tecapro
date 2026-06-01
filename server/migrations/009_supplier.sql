CREATE TABLE IF NOT EXISTS supplier (
  id             BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  code           VARCHAR(50) NOT NULL UNIQUE,
  name           VARCHAR(500) NOT NULL,
  tax_code       VARCHAR(50),
  address        TEXT,
  contact_person VARCHAR(255),
  phone          VARCHAR(50),
  email          VARCHAR(255),
  note           TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by     BIGINT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by     BIGINT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_code ON supplier(code);
CREATE INDEX IF NOT EXISTS idx_supplier_name ON supplier(name);
