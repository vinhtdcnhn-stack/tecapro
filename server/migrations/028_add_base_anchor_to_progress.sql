-- Mốc gốc đặc biệt (không phải một biên bản): hiện hỗ trợ 'contract' = ngày ký hợp đồng.
-- Khi base_anchor='contract' thì "Ngày dự kiến" = ngày ký HĐ + offset_days (bỏ qua base_bb_type_id).
ALTER TABLE public.contract_out_progress
  ADD COLUMN IF NOT EXISTS base_anchor varchar(20);
