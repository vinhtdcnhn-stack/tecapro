-- Khóa nhập liệu cho đợt nhận hàng (HĐ nhập). Khi locked=true, KHÔNG ai được sửa/thêm/xóa
-- hàng hóa & serial của đợt (kể cả admin) cho tới khi mở khóa. Khóa/mở khóa = người tạo HĐ + admin.
ALTER TABLE public.contract_in_delivery
  ADD COLUMN IF NOT EXISTS locked    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_by integer REFERENCES public.app_user(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;
