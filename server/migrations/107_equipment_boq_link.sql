-- Nối THIẾT BỊ BÀN GIAO (tab Bảo hành) với DÒNG BẢNG GIÁ của chính hợp đồng bán.
--
-- Mục tiêu: bảng giá là NGUỒN DUY NHẤT cho tên hàng + mốc bảo hành.
--   • Thiết bị gắn dòng bảng giá (boq_id) thì:
--       - name            lấy theo contract_out_boq.item_name
--       - warranty_bb_id  lấy theo dòng bảng giá (thiếu → mặc định contract_out.boq_warranty_bb_id)
--       - warranty_months lấy theo dòng bảng giá (thiếu → mặc định contract_out.boq_warranty_months)
--       - warranty_from   = actual_date của biên bản mốc; warranty_to = from + số tháng
--     Bốn cột trên vẫn được LƯU trên contract_equipment (không bỏ) vì tra cứu serial và
--     báo cáo bảo hành đọc thẳng từ đó; chúng được ghi lại (đồng bộ) mỗi khi bảng giá,
--     mốc bảo hành mặc định hoặc ngày thực tế của biên bản thay đổi.
--   • Thiết bị KHÔNG gắn (boq_id NULL): giữ nguyên cách cũ — tự nhập tên và mốc bảo hành.
--     Gồm thiết bị cũ và linh kiện tự sinh từ phía nhập (importComponentSync).
--
-- Xóa dòng bảng giá ⇒ boq_id về NULL (thiết bị quay lại chế độ nhập tay, không mất dữ liệu).

ALTER TABLE public.contract_equipment
  ADD COLUMN IF NOT EXISTS boq_id bigint;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_equipment_boq_id_fkey') THEN
    ALTER TABLE public.contract_equipment
      ADD CONSTRAINT contract_equipment_boq_id_fkey
      FOREIGN KEY (boq_id) REFERENCES public.contract_out_boq(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_contract_equipment_boq ON public.contract_equipment (boq_id);
