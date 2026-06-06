-- Link actual payments to a specific receivable schedule item
ALTER TABLE public.contract_receivable_payment
  ADD COLUMN IF NOT EXISTS schedule_id bigint REFERENCES public.contract_receivable(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pay_schedule ON public.contract_receivable_payment(schedule_id);
