-- Nhật ký đã gửi cảnh báo nợ quá hạn — để gửi "lần 1 khi chạm mốc" + "lần 2 đầu mỗi
-- tuần" mà không gửi trùng (module server/services/overdueDebtScheduler.js).
CREATE TABLE IF NOT EXISTS public.overdue_alert_log (
  id            bigserial PRIMARY KEY,
  receivable_id bigint NOT NULL REFERENCES public.contract_receivable(id) ON DELETE CASCADE,
  tier          varchar(10) NOT NULL,                 -- '1-7' | '8-15' | '16-30' | '>30'
  sent_on       date NOT NULL DEFAULT CURRENT_DATE,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_overdue_alert_recv ON public.overdue_alert_log(receivable_id);
