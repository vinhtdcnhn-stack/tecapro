-- Mốc gốc để tính "Số ngày": biên bản X mà user chọn (dropdown).
-- "Ngày dự kiến" = ngày thực tế của biên bản X (nếu đã ký, nếu chưa thì ngày dự kiến của X) + offset_days.
-- NULL = mặc định lấy biên bản liền trước (giữ tương thích cũ).
ALTER TABLE public.contract_out_progress
  ADD COLUMN IF NOT EXISTS base_bb_type_id integer
    REFERENCES public.contract_bb_type(id) ON DELETE SET NULL;
