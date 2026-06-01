-- BOQ (Bill of Quantities) OUT for contract_out
-- Run this migration manually on the database

CREATE TABLE IF NOT EXISTS public.contract_out_boq (
  id          bigserial PRIMARY KEY,
  contract_out_id bigint NOT NULL,
  sort_order  integer NOT NULL DEFAULT 1,
  item_name   varchar(500) NOT NULL DEFAULT '',
  hs_code     varchar(100) DEFAULT '',
  unit        varchar(100) DEFAULT '',
  quantity    numeric(18, 4) NOT NULL DEFAULT 0,
  unit_price  numeric(18, 2) NOT NULL DEFAULT 0,
  amount_before_vat numeric(18, 2) NOT NULL DEFAULT 0,
  vat_rate    numeric(5, 2) NOT NULL DEFAULT 0,
  amount_after_vat  numeric(18, 2) NOT NULL DEFAULT 0,
  warranty_period varchar(255) DEFAULT '',
  created_at  timestamp without time zone DEFAULT now(),
  updated_at  timestamp without time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boq_contract ON public.contract_out_boq(contract_out_id);
CREATE INDEX IF NOT EXISTS idx_boq_sort    ON public.contract_out_boq(contract_out_id, sort_order);
