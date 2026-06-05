-- Add item_type to contract_out_boq: 'trong_nuoc' (default) or 'di_thang'
ALTER TABLE public.contract_out_boq
  ADD COLUMN IF NOT EXISTS item_type varchar(20) NOT NULL DEFAULT 'trong_nuoc';
