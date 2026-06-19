-- Tách "Thiết bị bàn giao" (HĐ bán) theo ĐỢT GIAO HÀNG, tương tự đợt nhận hàng của HĐ nhập.
--   contract_out_delivery : đợt giao hàng (batch_name, delivery_date, note)
--   contract_equipment.delivery_id : thiết bị thuộc đợt nào
-- Xóa đợt → CASCADE xóa thiết bị của đợt → CASCADE xóa serial (equipment_serial).

CREATE TABLE IF NOT EXISTS public.contract_out_delivery (
  id serial PRIMARY KEY,
  contract_out_id bigint NOT NULL REFERENCES public.contract_out(id) ON DELETE CASCADE,
  batch_name varchar(200),
  delivery_date date,
  note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_out_delivery_contract
  ON public.contract_out_delivery(contract_out_id);

ALTER TABLE public.contract_equipment
  ADD COLUMN IF NOT EXISTS delivery_id integer
    REFERENCES public.contract_out_delivery(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_equipment_delivery
  ON public.contract_equipment(delivery_id);

-- Backfill: mỗi HĐ bán đang có thiết bị chưa gán đợt → tạo "Đợt giao hàng 1" và gán tất cả vào.
DO $$
DECLARE c record; new_id integer;
BEGIN
  FOR c IN
    SELECT DISTINCT contract_out_id
    FROM public.contract_equipment
    WHERE delivery_id IS NULL
  LOOP
    INSERT INTO public.contract_out_delivery (contract_out_id, batch_name)
      VALUES (c.contract_out_id, 'Đợt giao hàng 1')
      RETURNING id INTO new_id;
    UPDATE public.contract_equipment
      SET delivery_id = new_id
      WHERE contract_out_id = c.contract_out_id AND delivery_id IS NULL;
  END LOOP;
END $$;
