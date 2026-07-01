-- 089_change_log.sql — Nhật ký thay đổi (audit/change log) cho module Hợp đồng.
--
-- Ghi MỌI INSERT/UPDATE/DELETE trên các bảng HĐ bán + HĐ nhập ở mức CHI TIẾT TRƯỜNG
-- (giá trị cũ → mới), kèm người thao tác (actor_id) và thời điểm. Người thao tác được
-- gắn qua biến phiên `app.audit_actor` do server set trước mỗi câu lệnh ghi (xem
-- server/db.js + server/middleware/auditActor.js). Giao diện đọc: trang admin
-- "Nhật ký thay đổi" (chỉ admin) — server/controllers/auditController.js.
--
-- Khác record_history cũ (062/063, đã gỡ ở 086): có actor, có diff cột thay đổi, không
-- ghi update no-op, và phục vụ NGƯỜI ĐỌC (không phải dựng lại as-of).
--
-- Áp tay file này lên CẢ local lẫn VPS (theo CLAUDE.md). KHÔNG backfill — lịch sử bắt
-- đầu từ thời điểm bật.

-- ── Bảng nhật ký ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.change_log (
  id              bigserial   PRIMARY KEY,
  table_name      text        NOT NULL,
  row_id          bigint,
  contract_out_id bigint,                 -- resolve trong trigger để lọc theo HĐ
  op              char(1)     NOT NULL,    -- 'I' | 'U' | 'D'
  actor_id        integer,                 -- từ current_setting('app.audit_actor')
  changed_keys    text[],                  -- cột thực sự đổi (chỉ với UPDATE)
  before          jsonb,                   -- NULL khi op='I'
  after           jsonb,                   -- NULL khi op='D'
  at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_change_log_contract ON public.change_log (contract_out_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_change_log_row      ON public.change_log (table_name, row_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_change_log_actor    ON public.change_log (actor_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_change_log_at       ON public.change_log (at DESC);

-- ── Resolve contract_out_id của một hàng bất kỳ ────────────────────────────────
-- Ưu tiên cột trực tiếp; nếu không có thì leo lên cha theo từng bảng. Trả NULL nếu
-- không xác định được (vd cascade delete cả HĐ) — hàng vẫn được ghi, chỉ không gắn HĐ.
CREATE OR REPLACE FUNCTION public.fn_resolve_contract_out_id(p_table text, p_row jsonb)
RETURNS bigint AS $$
DECLARE v bigint;
BEGIN
  IF p_row IS NULL THEN RETURN NULL; END IF;

  IF p_table = 'contract_out' THEN
    RETURN (p_row->>'id')::bigint;
  END IF;
  IF p_row ? 'contract_out_id' AND p_row->>'contract_out_id' IS NOT NULL THEN
    RETURN (p_row->>'contract_out_id')::bigint;
  END IF;
  -- document_file / document_folder dùng cột 'contract_id' = id HĐ bán.
  IF p_row ? 'contract_id' AND p_row->>'contract_id' IS NOT NULL THEN
    RETURN (p_row->>'contract_id')::bigint;
  END IF;
  -- Mọi bảng con HĐ nhập có 'contract_in_id'.
  IF p_row ? 'contract_in_id' AND p_row->>'contract_in_id' IS NOT NULL THEN
    SELECT contract_out_id INTO v FROM public.contract_in WHERE id = (p_row->>'contract_in_id')::bigint;
    RETURN v;
  END IF;

  CASE p_table
    WHEN 'contract_task_attachment' THEN
      SELECT contract_out_id INTO v FROM public.contract_task WHERE id = (p_row->>'task_id')::bigint;
    WHEN 'contract_out_invoice_item' THEN
      SELECT contract_out_id INTO v FROM public.contract_out_invoice WHERE id = (p_row->>'invoice_id')::bigint;
    WHEN 'contract_in_delivery_item' THEN
      SELECT ci.contract_out_id INTO v
        FROM public.contract_in_delivery d JOIN public.contract_in ci ON ci.id = d.contract_in_id
       WHERE d.id = (p_row->>'delivery_id')::bigint;
    WHEN 'contract_in_delivery_serial' THEN
      SELECT ci.contract_out_id INTO v
        FROM public.contract_in_delivery_item it
        JOIN public.contract_in_delivery d ON d.id = it.delivery_id
        JOIN public.contract_in ci ON ci.id = d.contract_in_id
       WHERE it.id = (p_row->>'delivery_item_id')::bigint;
    WHEN 'contract_in_logistics_update' THEN
      SELECT ci.contract_out_id INTO v
        FROM public.contract_in_logistics l JOIN public.contract_in ci ON ci.id = l.contract_in_id
       WHERE l.id = (p_row->>'logistics_id')::bigint;
    WHEN 'warranty_case_equipment', 'warranty_activity' THEN
      SELECT contract_out_id INTO v FROM public.warranty_case WHERE id = (p_row->>'case_id')::bigint;
    WHEN 'equipment_serial' THEN
      SELECT contract_out_id INTO v FROM public.contract_equipment WHERE id = (p_row->>'equipment_id')::bigint;
    ELSE v := NULL;
  END CASE;
  RETURN v;
END;
$$ LANGUAGE plpgsql;

-- ── Trigger tổng quát ─────────────────────────────────────────────────────────
-- Bỏ cột nhiễu khỏi snapshot/so sánh: updated_at (luôn bị bump) + amount_vnd (giá trị
-- dẫn xuất = amount × tỷ giá). created_at giữ lại (không đổi sau insert → không gây
-- changed_keys). UPDATE không đổi gì thực sự → không ghi (no-op như chỉ chạm updated_at).
CREATE OR REPLACE FUNCTION public.fn_change_log() RETURNS trigger AS $$
DECLARE
  b jsonb;
  a jsonb;
  k text;
  changed text[] := '{}';
  rid bigint;
  coid bigint;
BEGIN
  IF TG_OP <> 'INSERT' THEN b := (to_jsonb(OLD) - 'updated_at' - 'amount_vnd'); END IF;
  IF TG_OP <> 'DELETE' THEN a := (to_jsonb(NEW) - 'updated_at' - 'amount_vnd'); END IF;

  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT jsonb_object_keys(b || a) LOOP
      IF (b->k) IS DISTINCT FROM (a->k) THEN changed := array_append(changed, k); END IF;
    END LOOP;
    IF array_length(changed, 1) IS NULL THEN RETURN NEW; END IF;  -- no-op, bỏ qua
  END IF;

  rid  := COALESCE((a->>'id'), (b->>'id'))::bigint;
  coid := public.fn_resolve_contract_out_id(TG_TABLE_NAME, COALESCE(a, b));

  INSERT INTO public.change_log(table_name, row_id, contract_out_id, op, actor_id, changed_keys, before, after)
  VALUES (
    TG_TABLE_NAME, rid, coid,
    CASE TG_OP WHEN 'INSERT' THEN 'I' WHEN 'UPDATE' THEN 'U' ELSE 'D' END,
    NULLIF(current_setting('app.audit_actor', true), '')::int,
    CASE WHEN TG_OP = 'UPDATE' THEN changed ELSE NULL END,
    b, a
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Gắn trigger cho mọi bảng module HĐ (bỏ qua bảng chưa tồn tại để chạy lại an toàn) ──
DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    -- HĐ bán + con
    'contract_out', 'contract_out_member', 'contract_out_boq', 'contract_out_progress',
    'contract_receivable', 'contract_receivable_payment', 'contract_task',
    'contract_task_attachment', 'contract_guarantee', 'contract_equipment', 'equipment_serial',
    'contract_out_delivery', 'contract_out_invoice', 'contract_out_invoice_item',
    'warranty_case', 'warranty_case_equipment', 'warranty_activity',
    'document', 'document_file', 'document_folder',
    -- HĐ nhập + con
    'contract_in', 'contract_in_boq', 'contract_in_payable', 'contract_in_payment',
    'contract_in_delivery', 'contract_in_delivery_item', 'contract_in_delivery_serial',
    'contract_in_guarantee', 'contract_in_customs', 'contract_in_logistics',
    'contract_in_logistics_update', 'contract_in_progress', 'contract_in_supplier_warranty',
    'contract_in_warranty_claim'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_changelog ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_changelog AFTER INSERT OR UPDATE OR DELETE ON public.%I '
        'FOR EACH ROW EXECUTE FUNCTION public.fn_change_log()', t);
    END IF;
  END LOOP;
END $$;
