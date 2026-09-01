-- Mốc tính bảo hành cho DÒNG BẢNG GIÁ (cả đầu bán và đầu nhập).
--
-- Trước đây cột warranty_period chỉ là chữ tự do ("36 tháng") nên không tính được ngày.
-- Nay thêm 2 trường theo đúng mẫu đã dùng cho thiết bị bảo hành (migration 053):
--   warranty_bb_id  : biên bản (tab "Tiến độ biên bản") làm mốc BẮT ĐẦU bảo hành
--                     → ngày bắt đầu = actual_date (ngày thực tế) của biên bản đó
--   warranty_months : số tháng bảo hành → ngày kết thúc = ngày bắt đầu + N tháng
--
-- Mốc/số tháng còn có MẶC ĐỊNH CẤP HỢP ĐỒNG (contract_out / contract_in): dòng nào bỏ
-- trống thì lấy theo mặc định, dòng nào điền riêng thì ghi đè mặc định.
--
-- Đầu bán: biên bản lấy từ contract_out_progress của chính HĐ bán.
-- Đầu nhập: biên bản lấy từ contract_in_progress của chính HĐ nhập (BH nhà cung cấp
--           tính từ ngày nghiệm thu/bàn giao với NCC).

-- ── Đầu bán ──────────────────────────────────────────────────────────────────
ALTER TABLE public.contract_out_boq
  ADD COLUMN IF NOT EXISTS warranty_bb_id  bigint,
  ADD COLUMN IF NOT EXISTS warranty_months integer;

ALTER TABLE public.contract_out
  ADD COLUMN IF NOT EXISTS boq_warranty_bb_id  bigint,
  ADD COLUMN IF NOT EXISTS boq_warranty_months integer;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_out_boq_warranty_bb_id_fkey') THEN
    ALTER TABLE public.contract_out_boq
      ADD CONSTRAINT contract_out_boq_warranty_bb_id_fkey
      FOREIGN KEY (warranty_bb_id) REFERENCES public.contract_out_progress(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_out_boq_warranty_default_fkey') THEN
    ALTER TABLE public.contract_out
      ADD CONSTRAINT contract_out_boq_warranty_default_fkey
      FOREIGN KEY (boq_warranty_bb_id) REFERENCES public.contract_out_progress(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_out_boq_warranty_bb ON public.contract_out_boq (warranty_bb_id);

-- ── Đầu nhập ─────────────────────────────────────────────────────────────────
ALTER TABLE public.contract_in_boq
  ADD COLUMN IF NOT EXISTS warranty_bb_id  integer,
  ADD COLUMN IF NOT EXISTS warranty_months integer;

ALTER TABLE public.contract_in
  ADD COLUMN IF NOT EXISTS boq_warranty_bb_id  integer,
  ADD COLUMN IF NOT EXISTS boq_warranty_months integer;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_in_boq_warranty_bb_id_fkey') THEN
    ALTER TABLE public.contract_in_boq
      ADD CONSTRAINT contract_in_boq_warranty_bb_id_fkey
      FOREIGN KEY (warranty_bb_id) REFERENCES public.contract_in_progress(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_in_boq_warranty_default_fkey') THEN
    ALTER TABLE public.contract_in
      ADD CONSTRAINT contract_in_boq_warranty_default_fkey
      FOREIGN KEY (boq_warranty_bb_id) REFERENCES public.contract_in_progress(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_in_boq_warranty_bb ON public.contract_in_boq (warranty_bb_id);

-- ── Chuyển dữ liệu cũ: đọc số tháng từ chữ đã gõ trong warranty_period ────────
-- "36 tháng"/"36 thang" → 36 ; "3 năm"/"3 nam" → 36. Không đụng dòng đã có số tháng.
-- Cột warranty_period GIỮ NGUYÊN (vẫn dùng để ghi chú điều kiện bảo hành đặc thù).
UPDATE public.contract_out_boq
   SET warranty_months = (regexp_match(lower(warranty_period), '(\d+)\s*th[aá]ng'))[1]::int
 WHERE warranty_months IS NULL AND lower(warranty_period) ~ '\d+\s*th[aá]ng';

UPDATE public.contract_out_boq
   SET warranty_months = (regexp_match(lower(warranty_period), '(\d+)\s*n[aă]m'))[1]::int * 12
 WHERE warranty_months IS NULL AND lower(warranty_period) ~ '\d+\s*n[aă]m';

UPDATE public.contract_in_boq
   SET warranty_months = (regexp_match(lower(warranty_period), '(\d+)\s*th[aá]ng'))[1]::int
 WHERE warranty_months IS NULL AND lower(warranty_period) ~ '\d+\s*th[aá]ng';

UPDATE public.contract_in_boq
   SET warranty_months = (regexp_match(lower(warranty_period), '(\d+)\s*n[aă]m'))[1]::int * 12
 WHERE warranty_months IS NULL AND lower(warranty_period) ~ '\d+\s*n[aă]m';
