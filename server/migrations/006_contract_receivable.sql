-- Phải thu theo ĐKTT hợp đồng (receivable schedule)
CREATE TABLE IF NOT EXISTS public.contract_receivable (
  id              bigserial PRIMARY KEY,
  contract_out_id bigint        NOT NULL,
  sort_order      integer       DEFAULT 1,
  description     varchar(500)  DEFAULT '',   -- Mô tả điều kiện thanh toán
  currency_code   varchar(10)   DEFAULT 'VND',
  amount          numeric(18,2) DEFAULT 0,    -- Giá trị theo đồng tiền gốc
  exchange_rate   numeric(18,4) DEFAULT 1,    -- Tỷ giá
  amount_vnd      numeric(18,2) DEFAULT 0,    -- Quy đổi VNĐ
  due_date        date,                       -- Thời hạn thu
  delay_reason    text          DEFAULT '',   -- Nguyên nhân trượt công nợ
  created_at      timestamp     DEFAULT now(),
  updated_at      timestamp     DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recv_contract ON public.contract_receivable(contract_out_id);
CREATE INDEX IF NOT EXISTS idx_recv_sort     ON public.contract_receivable(contract_out_id, sort_order);

-- Tiền về thực tế (actual payments received)
CREATE TABLE IF NOT EXISTS public.contract_receivable_payment (
  id              bigserial PRIMARY KEY,
  contract_out_id bigint        NOT NULL,
  sort_order      integer       DEFAULT 1,
  payment_date    date,
  currency_code   varchar(10)   DEFAULT 'VND',
  amount          numeric(18,2) DEFAULT 0,
  exchange_rate   numeric(18,4) DEFAULT 1,
  amount_vnd      numeric(18,2) DEFAULT 0,
  payment_ratio   numeric(6,2)  DEFAULT 0,    -- Tỷ lệ TT (%) — tùy chọn
  note            text          DEFAULT '',
  created_at      timestamp     DEFAULT now(),
  updated_at      timestamp     DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pay_contract ON public.contract_receivable_payment(contract_out_id);
CREATE INDEX IF NOT EXISTS idx_pay_sort     ON public.contract_receivable_payment(contract_out_id, sort_order);
