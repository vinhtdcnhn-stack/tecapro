-- Doanh thu xuất hóa đơn (HĐ bán) — theo từng ĐỢT xuất hóa đơn (#7 file kế toán).
-- Hybrid: nhập tay từng đợt + import Excel; mỗi dòng có thể link tới 1 dòng bảng giá
-- (contract_out_boq) để tính "số lượng tồn chưa xuất".
CREATE TABLE IF NOT EXISTS public.contract_out_invoice (
  id              bigserial PRIMARY KEY,
  contract_out_id bigint NOT NULL REFERENCES public.contract_out(id) ON DELETE CASCADE,
  invoice_no      varchar(100) DEFAULT '',
  invoice_date    date,
  currency_code   varchar(10) DEFAULT 'VND',
  exchange_rate   numeric(18,4) DEFAULT 1,
  note            text DEFAULT '',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coi_contract ON public.contract_out_invoice(contract_out_id);
CREATE INDEX IF NOT EXISTS idx_coi_date     ON public.contract_out_invoice(invoice_date);

CREATE TABLE IF NOT EXISTS public.contract_out_invoice_item (
  id                bigserial PRIMARY KEY,
  invoice_id        bigint NOT NULL REFERENCES public.contract_out_invoice(id) ON DELETE CASCADE,
  boq_id            bigint REFERENCES public.contract_out_boq(id) ON DELETE SET NULL,
  item_name         varchar(500) DEFAULT '',
  unit              varchar(100) DEFAULT '',
  quantity          numeric(18,4) DEFAULT 0,
  unit_price        numeric(18,2) DEFAULT 0,
  amount_before_vat numeric(18,2) DEFAULT 0,
  vat_rate          numeric(5,2) DEFAULT 0,
  amount_after_vat  numeric(18,2) DEFAULT 0,
  sort_order        integer DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_coii_invoice ON public.contract_out_invoice_item(invoice_id);
CREATE INDEX IF NOT EXISTS idx_coii_boq     ON public.contract_out_invoice_item(boq_id);
