-- "Số ngày" giãn cách so với biên bản liền trước (theo điều khoản tiến độ HĐ).
-- Dùng để tính cột "Ngày dự kiến (động)" — mốc tự nhảy theo ngày thực tế đã ký.
ALTER TABLE public.contract_out_progress
  ADD COLUMN IF NOT EXISTS offset_days integer;
