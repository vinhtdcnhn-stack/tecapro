-- Thay thế serial sau bảo hành: con cũ trỏ tới con mới thay thế nó.
-- Khác với parent_serial_id (= "thuộc máy nào"); đây là chuỗi thay thế theo thời gian.
ALTER TABLE equipment_serial
  ADD COLUMN IF NOT EXISTS replaced_by_serial_id INTEGER
    REFERENCES equipment_serial(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replaced_at DATE;

CREATE INDEX IF NOT EXISTS idx_equipment_serial_replaced_by
  ON equipment_serial(replaced_by_serial_id);
