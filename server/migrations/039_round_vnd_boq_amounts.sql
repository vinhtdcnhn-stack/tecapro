-- 039_round_vnd_boq_amounts.sql
-- Làm tròn dữ liệu bảng giá đã lưu cho các HĐ dùng VND về số nguyên
-- (đơn giá, thành tiền trước/sau VAT), theo đúng nguyên tắc: VND không lấy
-- phần thập phân. Tính lại thành tiền từ đơn giá đã làm tròn để khớp runtime.
-- HĐ ngoại tệ được GIỮ NGUYÊN (cột amount vốn đã numeric(_,2); đơn giá ngoại tệ
-- không bị cắt để tránh mất độ chính xác đã nhập trước khi áp dụng quy tắc).
--
-- An toàn chạy nhiều lần (idempotent): làm tròn lần 2 không đổi giá trị.

BEGIN;

-- ── Bảng giá bán (contract_out_boq) ──────────────────────────────────────────
UPDATE public.contract_out_boq b
SET unit_price        = round(b.unit_price),
    amount_before_vat = round(b.quantity * round(b.unit_price)),
    amount_after_vat  = round(round(b.quantity * round(b.unit_price)) * (1 + b.vat_rate / 100)),
    updated_at        = now()
FROM public.contract_out c
WHERE c.id = b.contract_out_id
  AND COALESCE(c.currency_code, 'VND') = 'VND';

-- Đồng bộ tổng giá trị HĐ bán
UPDATE public.contract_out c
SET amount_before_vat = COALESCE(t.bsum, 0),
    amount_after_vat  = COALESCE(t.asum, 0),
    updated_at        = now()
FROM (
  SELECT contract_out_id,
         SUM(amount_before_vat) AS bsum,
         SUM(amount_after_vat)  AS asum
  FROM public.contract_out_boq
  GROUP BY contract_out_id
) t
WHERE c.id = t.contract_out_id
  AND COALESCE(c.currency_code, 'VND') = 'VND';

-- ── Bảng giá mua (contract_in_boq) ───────────────────────────────────────────
UPDATE contract_in_boq b
SET unit_price        = round(b.unit_price),
    amount_before_vat = round(b.quantity * round(b.unit_price)),
    amount_after_vat  = round(round(b.quantity * round(b.unit_price)) * (1 + b.vat_rate / 100)),
    updated_at        = NOW()
FROM contract_in c
WHERE c.id = b.contract_in_id
  AND COALESCE(c.currency_code, 'VND') = 'VND';

-- Đồng bộ tổng giá trị HĐ nhập (amount = SUM amount_after_vat)
UPDATE contract_in c
SET amount     = COALESCE(t.asum, 0),
    updated_at = NOW()
FROM (
  SELECT contract_in_id, SUM(amount_after_vat) AS asum
  FROM contract_in_boq
  GROUP BY contract_in_id
) t
WHERE c.id = t.contract_in_id
  AND COALESCE(c.currency_code, 'VND') = 'VND';

COMMIT;
