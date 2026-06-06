-- Bảo hành theo TỪNG serial + liên kết (tùy chọn) tới máy chứa nó.
-- Lý do: linh kiện (CPU/RAM/ổ cứng/nguồn...) nhập rời, mỗi cái có hạn bảo hành riêng,
-- và nhiều khi không biết thuộc máy nào nên parent để trống.
ALTER TABLE equipment_serial
  ADD COLUMN IF NOT EXISTS warranty_from   DATE,
  ADD COLUMN IF NOT EXISTS warranty_to     DATE,
  ADD COLUMN IF NOT EXISTS parent_serial_id INTEGER
    REFERENCES equipment_serial(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_serial_parent ON equipment_serial(parent_serial_id);
