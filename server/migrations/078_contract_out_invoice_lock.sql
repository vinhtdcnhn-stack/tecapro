-- Khóa đợt xuất hóa đơn (HĐ bán). Khi locked=true, KHÔNG ai được sửa/xóa đợt (kể cả
-- admin) cho tới khi mở khóa. Khóa/mở khóa = PM của HĐ + admin (như quyền ghi đợt).
ALTER TABLE public.contract_out_invoice
  ADD COLUMN IF NOT EXISTS locked    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_by integer REFERENCES public.app_user(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;
