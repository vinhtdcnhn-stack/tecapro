-- Thời hạn thu (due_date) của khoản phải thu có thể tính động theo biên bản,
-- giống "Ngày dự kiến" ở tab Tiến độ theo biên bản:
--   due_date = ngày của biên bản gốc (hoặc ngày ký HĐ) + due_offset_days.
-- Khi không chọn mốc gốc → due_date là ngày nhập tay (như cũ).
ALTER TABLE public.contract_receivable
  ADD COLUMN IF NOT EXISTS due_offset_days     integer,
  ADD COLUMN IF NOT EXISTS due_base_bb_type_id bigint,      -- loại biên bản làm mốc gốc
  ADD COLUMN IF NOT EXISTS due_base_anchor     varchar(20); -- 'contract' = ngày ký HĐ
