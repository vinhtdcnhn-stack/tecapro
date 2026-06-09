-- Hợp đồng bán có phải là hợp đồng liên danh hay không (ngầm định: không).
ALTER TABLE public.contract_out
  ADD COLUMN IF NOT EXISTS is_joint_venture boolean NOT NULL DEFAULT false;
