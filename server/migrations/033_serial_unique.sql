-- Serial phải duy nhất trong từng phía (toàn hệ thống), không phân biệt hoa/thường + bỏ khoảng trắng.
-- Phía nhập và phía bán ra độc lập nhau: cùng một serial được phép có ở cả hai bảng.

CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_serial_no
  ON contract_in_delivery_serial (lower(trim(serial_no)));

CREATE UNIQUE INDEX IF NOT EXISTS uq_equipment_serial_no
  ON equipment_serial (lower(trim(serial_no)));
