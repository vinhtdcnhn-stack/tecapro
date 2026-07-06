-- HĐ nhập nhập cho NHIỀU HĐ bán (link đa hợp đồng).
-- Trước đây contract_in.contract_out_id gắn cứng 1 HĐ nhập vào đúng 1 HĐ bán.
-- Bảng nối này liệt kê TẤT CẢ HĐ bán mà 1 HĐ nhập cung cấp hàng (kể cả HĐ "gốc"/home
-- = contract_in.contract_out_id, luôn có mặt và không xóa được).
--   - Cột "Nhập cho" (bảng giá mua) chọn được hàng bán của mọi HĐ bán trong tập này.
--   - Danh sách HĐ nhập của MỖI HĐ bán link hiển thị HĐ nhập dùng chung.
--   - Không bỏ được 1 HĐ bán khỏi tập nếu đã có hàng gắn vào Theo dõi nhập hàng của nó
--     (tồn tại contract_in_boq_supply_link trỏ tới BOQ của HĐ bán đó).

CREATE TABLE IF NOT EXISTS public.contract_in_target (
  id              bigserial PRIMARY KEY,
  contract_in_id  integer NOT NULL REFERENCES public.contract_in(id) ON DELETE CASCADE,
  contract_out_id bigint  NOT NULL REFERENCES public.contract_out(id) ON DELETE CASCADE,
  created_at      timestamp without time zone DEFAULT now(),
  UNIQUE (contract_in_id, contract_out_id)
);
CREATE INDEX IF NOT EXISTS ix_ci_target_in  ON public.contract_in_target(contract_in_id);
CREATE INDEX IF NOT EXISTS ix_ci_target_out ON public.contract_in_target(contract_out_id);

-- Backfill: mỗi HĐ nhập hiện có → 1 dòng target = HĐ bán home của nó.
INSERT INTO public.contract_in_target (contract_in_id, contract_out_id)
SELECT id, contract_out_id FROM public.contract_in
WHERE contract_out_id IS NOT NULL
ON CONFLICT DO NOTHING;
