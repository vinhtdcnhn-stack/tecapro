-- Cột "Ngày theo HĐ" (deadline theo hợp đồng) giờ cũng có thể tính động giống "Ngày dự kiến":
-- chọn mốc gốc (ngày ký HĐ hoặc một biên bản khác) + số ngày, hoặc nhập ngày trực tiếp.
-- Ngày theo HĐ tính theo NGÀY THEO HĐ của mốc gốc (không theo ngày thực tế) — khác với Ngày dự kiến.
-- Khi cả 3 trống → giữ nguyên kiểu nhập ngày tay vào planned_date (tương thích dữ liệu cũ).
ALTER TABLE public.contract_out_progress
  ADD COLUMN IF NOT EXISTS hd_offset_days integer,
  ADD COLUMN IF NOT EXISTS hd_base_bb_type_id integer
    REFERENCES public.contract_bb_type(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hd_base_anchor varchar(20);
