-- Lưu nguồn tính bảo hành cho thiết bị bàn giao để mở lại sửa còn đủ thông tin:
--   warranty_bb_id  : biên bản (contract_out_progress) làm mốc "BH từ" (lấy ngày thực tế)
--   warranty_months : số tháng bảo hành dùng để cộng ra "BH đến"
ALTER TABLE public.contract_equipment
  ADD COLUMN IF NOT EXISTS warranty_bb_id integer
    REFERENCES public.contract_out_progress(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS warranty_months integer;
