-- 108: KHÓA hợp đồng bán đã "Hoàn thành" (contract_out.status = 'Completed').
--
-- Khi HĐ bán ở trạng thái Hoàn thành, KHÔNG AI (kể cả admin) được thêm/sửa/xóa bất kỳ thành
-- phần nào của nó: thông tin HĐ, thành viên, bảng giá, tiến độ, công nợ, hóa đơn, công việc,
-- tài liệu, thiết bị/serial, bàn giao, và toàn bộ HĐ nhập thuộc HĐ đó (theo HĐ bán "nhà"
-- contract_in.contract_out_id). Muốn sửa phải chuyển HĐ về "Đang thực hiện" trước — việc này
-- chỉ Trưởng/Phó Ban Triển khai Dự án + admin làm được (gác ở tầng ứng dụng).
--
-- NGOẠI LỆ: Bảo hành (warranty_case / warranty_case_equipment / warranty_activity) vẫn ghi
-- được sau khi hoàn thành. Đánh dấu đã đọc (contract_task_read) không bị chặn.
--
-- Chặn ở DB bằng trigger BEFORE để không sót đường ghi nào. Chỉ chặn khi biến phiên
-- app.freeze_enforce = '1' — server/db.js chỉ bật biến này cho câu lệnh GHI trong request
-- KHÔNG phải GET của người dùng. Job nền (cron, không có người thao tác) và SQL tay không bị chặn.
-- Lỗi ném ra có SQLSTATE 'P0423' → server đổi thành HTTP 423 kèm thông báo tiếng Việt.

-- Tìm id HĐ bán của một dòng: dùng lại fn_resolve_contract_out_id (migration 089) + bổ sung
-- các bảng con chưa có trong đó.
CREATE OR REPLACE FUNCTION public.fn_freeze_contract_out_id(p_table text, p_row jsonb)
RETURNS bigint AS $$
DECLARE v bigint;
BEGIN
  IF p_row IS NULL THEN RETURN NULL; END IF;
  CASE p_table
    WHEN 'contract_task_dependency', 'contract_task_entry', 'contract_task_assignment_log' THEN
      SELECT contract_out_id INTO v FROM public.contract_task WHERE id = (p_row->>'task_id')::bigint;
      RETURN v;
    WHEN 'contract_task_entry_image' THEN
      SELECT t.contract_out_id INTO v
        FROM public.contract_task_entry e JOIN public.contract_task t ON t.id = e.task_id
       WHERE e.id = (p_row->>'entry_id')::bigint;
      RETURN v;
    WHEN 'contract_out_supply_slot' THEN
      SELECT contract_out_id INTO v FROM public.contract_out_boq WHERE id = (p_row->>'boq_id')::bigint;
      RETURN v;
    WHEN 'contract_in_boq_supply_link' THEN
      SELECT ci.contract_out_id INTO v
        FROM public.contract_in_boq b JOIN public.contract_in ci ON ci.id = b.contract_in_id
       WHERE b.id = (p_row->>'contract_in_boq_id')::bigint;
      RETURN v;
    ELSE
      RETURN public.fn_resolve_contract_out_id(p_table, p_row);
  END CASE;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.fn_contract_freeze() RETURNS trigger AS $$
DECLARE
  coid bigint;
  st text;
  no text;
BEGIN
  IF COALESCE(current_setting('app.freeze_enforce', true), '') <> '1' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'contract_out' THEN
    -- Chính HĐ bán: chỉ cho UPDATE khi đang ĐỔI KHỎI trạng thái Hoàn thành (mở lại).
    -- INSERT luôn được; UPDATE/DELETE một HĐ đang Hoàn thành mà vẫn giữ Hoàn thành → chặn.
    IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
    IF OLD.status = 'Completed' AND (TG_OP = 'DELETE' OR NEW.status = 'Completed') THEN
      RAISE EXCEPTION 'Hợp đồng % đã Hoàn thành — không thể sửa. Cần Trưởng/Phó Ban Triển khai Dự án chuyển về "Đang thực hiện" trước.', OLD.contract_no
        USING ERRCODE = 'P0423';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  -- Bảng con: kiểm tra cả dòng cũ lẫn dòng mới (chặn cả việc chuyển dòng sang HĐ đã khóa).
  FOREACH coid IN ARRAY ARRAY[
    CASE WHEN TG_OP <> 'INSERT' THEN public.fn_freeze_contract_out_id(TG_TABLE_NAME, to_jsonb(OLD)) END,
    CASE WHEN TG_OP <> 'DELETE' THEN public.fn_freeze_contract_out_id(TG_TABLE_NAME, to_jsonb(NEW)) END
  ] LOOP
    CONTINUE WHEN coid IS NULL;
    SELECT status, contract_no INTO st, no FROM public.contract_out WHERE id = coid;
    IF st = 'Completed' THEN
      RAISE EXCEPTION 'Hợp đồng % đã Hoàn thành — không thể sửa. Cần Trưởng/Phó Ban Triển khai Dự án chuyển về "Đang thực hiện" trước.', no
        USING ERRCODE = 'P0423';
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    -- HĐ bán + con (KHÔNG gồm warranty_case/warranty_case_equipment/warranty_activity, contract_task_read)
    'contract_out', 'contract_out_member', 'contract_out_boq', 'contract_out_progress',
    'contract_out_supply_slot', 'contract_receivable', 'contract_receivable_payment',
    'contract_task', 'contract_task_attachment', 'contract_task_dependency',
    'contract_task_entry', 'contract_task_entry_image', 'contract_task_assignment_log',
    'contract_guarantee', 'contract_equipment', 'equipment_serial',
    'contract_out_delivery', 'contract_out_invoice', 'contract_out_invoice_item',
    'document', 'document_file', 'document_folder',
    -- HĐ nhập + con
    'contract_in', 'contract_in_target', 'contract_in_boq', 'contract_in_boq_supply_link',
    'contract_in_payable', 'contract_in_payment',
    'contract_in_delivery', 'contract_in_delivery_item', 'contract_in_delivery_serial',
    'contract_in_guarantee', 'contract_in_customs', 'contract_in_logistics',
    'contract_in_logistics_update', 'contract_in_progress', 'contract_in_supplier_warranty',
    'contract_in_warranty_claim'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_contract_freeze ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_contract_freeze BEFORE INSERT OR UPDATE OR DELETE ON public.%I '
        'FOR EACH ROW EXECUTE FUNCTION public.fn_contract_freeze()', t);
    END IF;
  END LOOP;
END $$;
