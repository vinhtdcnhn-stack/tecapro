-- Cho phép gắn serial con (linh kiện) vào một serial cha (máy) ở phía NHẬP,
-- tương tự parent_serial_id của equipment_serial phía bán. Dùng cho màn
-- "Quản lý Serial" tập trung của hợp đồng nhập.
ALTER TABLE contract_in_delivery_serial
  ADD COLUMN IF NOT EXISTS parent_serial_id INTEGER
    REFERENCES contract_in_delivery_serial(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_serial_parent
  ON contract_in_delivery_serial(parent_serial_id);
