-- Cờ "nhân thành tiền theo số lượng hệ thống" cho dòng nhóm tổng hợp (row_kind='group').
--   false (mặc định) → thành tiền nhóm = SUM(các dòng con)            ← y như trước.
--   true             → thành tiền nhóm = SUM(các dòng con) × SL hệ thống (quantity).
-- Dùng khi 1 "hệ thống" (vd UPS 600kVA) lặp lại nhiều bộ: khai báo cấu hình 1 lần,
-- đặt SL = số bộ, bật cờ để thành tiền tự nhân lên. Roll-up + tổng HĐ tính theo cờ này.
ALTER TABLE public.contract_out_boq
  ADD COLUMN IF NOT EXISTS multiply_qty boolean NOT NULL DEFAULT false;
