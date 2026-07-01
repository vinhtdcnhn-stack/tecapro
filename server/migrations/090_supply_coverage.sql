-- Theo dõi độ phủ NHẬP HÀNG cho bảng giá HĐ bán ("đầu nhập").
-- Mục tiêu: mỗi dòng hàng bán (leaf) biết đã được các HĐ nhập phủ tới đâu (theo SL) để
-- đổi màu 🔴/🟡/🟢, tiện theo dõi tiến độ ký HĐ nhập hàng hóa.
--
-- 3 phần:
--   (0) contract_out_boq.no_import_needed — PM đánh dấu dòng KHÔNG cần nhập (dịch vụ, phần
--       mềm, nhân công, hàng trong nước...) ngay ở tab Bảng giá → loại khỏi theo dõi.
--   (1) contract_out_supply_slot — "đầu nhập" PM tách ra từ 1 dòng leaf cần phân cấp
--       (tên + SL kỳ vọng, KHÔNG có giá). Không tách = 1 đầu mặc định = cả dòng.
--   (2) contract_in_boq_supply_link — 1 dòng bảng giá NHẬP "nhập cho" 1 đầu/dòng bán,
--       kèm covered_qty (SL phủ theo đơn vị hàng bán). Ghép thủ công (tên nhập ≠ tên bán).

-- (0) Cờ "không cần nhập" trên dòng bảng giá bán -----------------------------------
ALTER TABLE public.contract_out_boq
  ADD COLUMN IF NOT EXISTS no_import_needed boolean NOT NULL DEFAULT false;

-- (1) Đầu nhập -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_out_supply_slot (
  id          bigserial PRIMARY KEY,
  boq_id      bigint NOT NULL REFERENCES public.contract_out_boq(id) ON DELETE CASCADE,
  name        varchar(500) NOT NULL DEFAULT '',
  needed_qty  numeric(18,4) NOT NULL DEFAULT 0,   -- SL kỳ vọng (đơn vị hàng bán)
  unit        varchar(100) NOT NULL DEFAULT '',
  sort_order  integer NOT NULL DEFAULT 1,
  note        text,
  created_at  timestamp without time zone DEFAULT now(),
  updated_at  timestamp without time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_supply_slot_boq ON public.contract_out_supply_slot(boq_id);

-- (2) Ghép hàng nhập → đầu/dòng bán --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_in_boq_supply_link (
  id                 bigserial PRIMARY KEY,
  contract_in_boq_id integer NOT NULL REFERENCES public.contract_in_boq(id) ON DELETE CASCADE,
  boq_id             bigint NOT NULL REFERENCES public.contract_out_boq(id) ON DELETE CASCADE,
  slot_id            bigint REFERENCES public.contract_out_supply_slot(id) ON DELETE CASCADE, -- NULL = cả dòng leaf
  covered_qty        numeric(18,4) NOT NULL DEFAULT 0,  -- SL phủ (đơn vị hàng bán)
  note               text,
  created_at         timestamp without time zone DEFAULT now(),
  updated_at         timestamp without time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_supply_link_inboq ON public.contract_in_boq_supply_link(contract_in_boq_id);
CREATE INDEX IF NOT EXISTS ix_supply_link_boq   ON public.contract_in_boq_supply_link(boq_id);
CREATE INDEX IF NOT EXISTS ix_supply_link_slot  ON public.contract_in_boq_supply_link(slot_id);
