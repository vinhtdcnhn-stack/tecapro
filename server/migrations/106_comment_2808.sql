-- 106_comment_2808.sql
-- Ý kiến sau cuộc họp triển khai 28/08/2026:
--   • Tiến độ theo biên bản của HĐ NHẬP: bổ sung công thức tính ngày (mốc gốc + số
--     ngày) giống bên HĐ bán → thêm 6 cột như contract_out_progress.
--   • Nhắc Telegram 7 ngày trước hạn công việc, CHỈ MỘT LẦN → cột đánh dấu đã nhắc.
-- Áp bằng tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

-- Ngày dự kiến (tính theo NGÀY THỰC TẾ của mốc gốc)
ALTER TABLE public.contract_in_progress ADD COLUMN IF NOT EXISTS offset_days        integer;
ALTER TABLE public.contract_in_progress ADD COLUMN IF NOT EXISTS base_bb_type_id    integer;
ALTER TABLE public.contract_in_progress ADD COLUMN IF NOT EXISTS base_anchor        varchar(20);
-- Ngày theo HĐ (tính theo NGÀY THEO HĐ của mốc gốc, hoặc nhập tay)
ALTER TABLE public.contract_in_progress ADD COLUMN IF NOT EXISTS hd_offset_days     integer;
ALTER TABLE public.contract_in_progress ADD COLUMN IF NOT EXISTS hd_base_bb_type_id integer;
ALTER TABLE public.contract_in_progress ADD COLUMN IF NOT EXISTS hd_base_anchor     varchar(20);

-- Mốc đã gửi nhắc "còn 7 ngày tới hạn" (NULL = chưa nhắc). Reset về NULL khi đổi
-- hạn để việc lùi/đẩy hạn được nhắc lại đúng một lần cho hạn mới.
ALTER TABLE public.contract_task ADD COLUMN IF NOT EXISTS due_soon_notified_at timestamptz;

-- Nhật ký thay đổi: bỏ luôn due_soon_notified_at khỏi snapshot/so sánh — đây là cờ
-- BỘ NHẮC HẠN tự đặt (không có người thao tác), ghi vào change_log chỉ làm nhiễu.
-- Thân hàm giữ NGUYÊN như migration 089, chỉ thêm một khóa bị loại.
CREATE OR REPLACE FUNCTION public.fn_change_log() RETURNS trigger AS $fn$
DECLARE
  b jsonb;
  a jsonb;
  k text;
  changed text[] := '{}';
  rid bigint;
  coid bigint;
BEGIN
  IF TG_OP <> 'INSERT' THEN b := (to_jsonb(OLD) - 'updated_at' - 'amount_vnd' - 'due_soon_notified_at'); END IF;
  IF TG_OP <> 'DELETE' THEN a := (to_jsonb(NEW) - 'updated_at' - 'amount_vnd' - 'due_soon_notified_at'); END IF;

  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT jsonb_object_keys(b || a) LOOP
      IF (b->k) IS DISTINCT FROM (a->k) THEN changed := array_append(changed, k); END IF;
    END LOOP;
    IF array_length(changed, 1) IS NULL THEN RETURN NEW; END IF;  -- no-op, bo qua
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
$fn$ LANGUAGE plpgsql;

COMMIT;
