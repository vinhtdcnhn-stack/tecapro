-- Lịch sử bản ghi (audit/snapshot) cho tính năng Dashboard "Xem tại 1 thời điểm".
-- Mỗi INSERT/UPDATE/DELETE trên các bảng theo dõi ghi 1 dòng ảnh chụp (to_jsonb) kèm
-- thời điểm. Báo cáo dựng lại giá trị "đúng phiên bản tại asOf" cho các trường mutable
-- (amount, status, due_date, is_deleted, ...) thay vì luôn đọc giá trị hiện tại.
-- Xem server/utils/historyAsOf.js + server/utils/reportLoaders.asof.js.

CREATE TABLE IF NOT EXISTS public.record_history (
  id          bigserial   PRIMARY KEY,
  table_name  text        NOT NULL,
  row_id      bigint      NOT NULL,
  op          char(1)     NOT NULL,            -- 'I' | 'U' | 'D'
  data        jsonb,                            -- ảnh chụp NEW; NULL khi op='D'
  valid_from  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_record_history_lookup
  ON public.record_history (table_name, row_id, valid_from DESC);

-- Trigger tổng quát: ghi snapshot toàn bộ hàng. Không cần liệt kê cột → thêm cột mới
-- không phải sửa trigger.
CREATE OR REPLACE FUNCTION public.fn_record_history() RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO public.record_history(table_name, row_id, op, data)
      VALUES (TG_TABLE_NAME, OLD.id, 'D', NULL);
    RETURN OLD;
  ELSE
    INSERT INTO public.record_history(table_name, row_id, op, data)
      VALUES (TG_TABLE_NAME, NEW.id,
              CASE WHEN TG_OP = 'INSERT' THEN 'I' ELSE 'U' END,
              to_jsonb(NEW));
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Gắn trigger cho 6 bảng theo dõi (drop trước để migration chạy lại được an toàn).
DROP TRIGGER IF EXISTS trg_hist_contract_out          ON public.contract_out;
DROP TRIGGER IF EXISTS trg_hist_contract_receivable   ON public.contract_receivable;
DROP TRIGGER IF EXISTS trg_hist_contract_task         ON public.contract_task;
DROP TRIGGER IF EXISTS trg_hist_contract_out_invoice  ON public.contract_out_invoice;
DROP TRIGGER IF EXISTS trg_hist_contract_out_inv_item ON public.contract_out_invoice_item;
DROP TRIGGER IF EXISTS trg_hist_contract_in_payable   ON public.contract_in_payable;

CREATE TRIGGER trg_hist_contract_out
  AFTER INSERT OR UPDATE OR DELETE ON public.contract_out
  FOR EACH ROW EXECUTE FUNCTION public.fn_record_history();
CREATE TRIGGER trg_hist_contract_receivable
  AFTER INSERT OR UPDATE OR DELETE ON public.contract_receivable
  FOR EACH ROW EXECUTE FUNCTION public.fn_record_history();
CREATE TRIGGER trg_hist_contract_task
  AFTER INSERT OR UPDATE OR DELETE ON public.contract_task
  FOR EACH ROW EXECUTE FUNCTION public.fn_record_history();
CREATE TRIGGER trg_hist_contract_out_invoice
  AFTER INSERT OR UPDATE OR DELETE ON public.contract_out_invoice
  FOR EACH ROW EXECUTE FUNCTION public.fn_record_history();
CREATE TRIGGER trg_hist_contract_out_inv_item
  AFTER INSERT OR UPDATE OR DELETE ON public.contract_out_invoice_item
  FOR EACH ROW EXECUTE FUNCTION public.fn_record_history();
CREATE TRIGGER trg_hist_contract_in_payable
  AFTER INSERT OR UPDATE OR DELETE ON public.contract_in_payable
  FOR EACH ROW EXECUTE FUNCTION public.fn_record_history();

-- ── Backfill baseline cho dữ liệu hiện có ─────────────────────────────────────
-- 1 snapshot 'I' / hàng, valid_from = thời điểm tạo gần nhất ước lượng được, để asOf
-- TRƯỚC lần sửa đầu tiên (chưa có lịch sử) vẫn trả ra giá trị hiện tại làm mốc, và để
-- hàng tạo-sau-asOf bị loại đúng. Mỗi khối tự bỏ qua nếu bảng đã có lịch sử (chạy lại).

INSERT INTO public.record_history(table_name, row_id, op, data, valid_from)
SELECT 'contract_out', t.id, 'I', to_jsonb(t),
       COALESCE(t.created_at::timestamptz, t.contract_date::timestamptz, now())
  FROM public.contract_out t
 WHERE NOT EXISTS (SELECT 1 FROM public.record_history h WHERE h.table_name = 'contract_out');

INSERT INTO public.record_history(table_name, row_id, op, data, valid_from)
SELECT 'contract_receivable', t.id, 'I', to_jsonb(t),
       COALESCE(t.created_at::timestamptz, now())
  FROM public.contract_receivable t
 WHERE NOT EXISTS (SELECT 1 FROM public.record_history h WHERE h.table_name = 'contract_receivable');

INSERT INTO public.record_history(table_name, row_id, op, data, valid_from)
SELECT 'contract_task', t.id, 'I', to_jsonb(t),
       COALESCE(t.created_at, now())
  FROM public.contract_task t
 WHERE NOT EXISTS (SELECT 1 FROM public.record_history h WHERE h.table_name = 'contract_task');

INSERT INTO public.record_history(table_name, row_id, op, data, valid_from)
SELECT 'contract_in_payable', t.id, 'I', to_jsonb(t),
       COALESCE(t.created_at, now())
  FROM public.contract_in_payable t
 WHERE NOT EXISTS (SELECT 1 FROM public.record_history h WHERE h.table_name = 'contract_in_payable');

INSERT INTO public.record_history(table_name, row_id, op, data, valid_from)
SELECT 'contract_out_invoice', t.id, 'I', to_jsonb(t),
       COALESCE(t.created_at, t.invoice_date::timestamptz, now())
  FROM public.contract_out_invoice t
 WHERE NOT EXISTS (SELECT 1 FROM public.record_history h WHERE h.table_name = 'contract_out_invoice');

-- Item không có created_at → dùng created_at của hóa đơn cha làm mốc.
INSERT INTO public.record_history(table_name, row_id, op, data, valid_from)
SELECT 'contract_out_invoice_item', it.id, 'I', to_jsonb(it),
       COALESCE(inv.created_at, inv.invoice_date::timestamptz, now())
  FROM public.contract_out_invoice_item it
  JOIN public.contract_out_invoice inv ON inv.id = it.invoice_id
 WHERE NOT EXISTS (SELECT 1 FROM public.record_history h WHERE h.table_name = 'contract_out_invoice_item');
