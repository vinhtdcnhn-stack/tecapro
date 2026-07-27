-- 103: Gắn đợt thanh toán NCC vào một KHOẢN PHẢI TRẢ cụ thể (giống contract_receivable_payment.schedule_id
-- bên công nợ HĐ bán). Xóa khoản phải trả → đợt thanh toán KHÔNG bị xóa theo, chỉ mất liên kết
-- (hiện ở mục "Đợt thanh toán chưa gắn khoản" để gắn lại).

ALTER TABLE public.contract_in_payment
  ADD COLUMN IF NOT EXISTS payable_id integer REFERENCES public.contract_in_payable(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contract_in_payment_payable ON public.contract_in_payment(payable_id);
