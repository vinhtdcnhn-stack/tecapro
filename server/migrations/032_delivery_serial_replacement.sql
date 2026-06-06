-- Cho phép thay thế serial phía NHẬP (serial nhận hàng từ NCC) sau bảo hành,
-- tương tự cơ chế thay thế của serial phía bán (equipment_serial).
ALTER TABLE contract_in_delivery_serial
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Đang hoạt động',
  ADD COLUMN IF NOT EXISTS replaced_by_serial_id INTEGER
    REFERENCES contract_in_delivery_serial(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replaced_at DATE;

CREATE INDEX IF NOT EXISTS idx_delivery_serial_replaced_by
  ON contract_in_delivery_serial(replaced_by_serial_id);
