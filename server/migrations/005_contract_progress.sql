-- BB type master table (global, not per-contract)
CREATE TABLE IF NOT EXISTS public.contract_bb_type (
  id         serial PRIMARY KEY,
  code       varchar(20)  NOT NULL UNIQUE,
  name       varchar(255) NOT NULL,
  sort_order integer      DEFAULT 0,
  is_active  boolean      DEFAULT true,
  created_at timestamp    DEFAULT now()
);

-- Default BB types
INSERT INTO public.contract_bb_type (code, name, sort_order) VALUES
  ('HOM',  'Biên bản bàn giao hàng hoá',              10),
  ('KCS',  'Biên bản kiểm tra chất lượng (KCS)',       20),
  ('HOC',  'Biên bản bàn giao có điều kiện',           30),
  ('PAT',  'Biên bản nghiệm thu tạm',                  40),
  ('PAC',  'Biên bản thanh lý tạm',                    50),
  ('TAT',  'Biên bản nghiệm thu chính thức',           60),
  ('TAM',  'Biên bản thanh toán trung gian',           70),
  ('TAC',  'Biên bản thanh lý hợp đồng',               80),
  ('BBTL', 'Biên bản thanh lý (kết thúc HĐ)',          90)
ON CONFLICT (code) DO NOTHING;

-- Progress tracking per contract
CREATE TABLE IF NOT EXISTS public.contract_out_progress (
  id              bigserial PRIMARY KEY,
  contract_out_id bigint    NOT NULL,
  bb_type_id      integer,
  sort_order      integer   DEFAULT 1,
  planned_date    date,
  actual_date     date,
  reason          text      DEFAULT '',
  penalty_note    text      DEFAULT '',
  created_at      timestamp DEFAULT now(),
  updated_at      timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_progress_contract ON public.contract_out_progress(contract_out_id);
CREATE INDEX IF NOT EXISTS idx_progress_sort     ON public.contract_out_progress(contract_out_id, sort_order);
