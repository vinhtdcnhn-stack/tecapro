-- Gỡ bỏ cơ chế record_history (migration 062 + 063). As-of (Dashboard/báo cáo "Xem tại
-- 1 thời điểm") không còn dựng lại số liệu quá khứ từ snapshot — khách nhập sai và sửa
-- thường xuyên nên báo cáo quá khứ giờ dùng dữ liệu LIVE (đã sửa), chỉ cắt theo ngày.
-- reportLoaders.asof.js + historyAsOf.js đã xóa; bảng/trigger này thành code chết, gỡ để
-- hết overhead ghi mỗi I/U/D.

-- 7 trigger theo dõi.
DROP TRIGGER IF EXISTS trg_hist_contract_out          ON public.contract_out;
DROP TRIGGER IF EXISTS trg_hist_contract_receivable   ON public.contract_receivable;
DROP TRIGGER IF EXISTS trg_hist_contract_task         ON public.contract_task;
DROP TRIGGER IF EXISTS trg_hist_contract_out_invoice  ON public.contract_out_invoice;
DROP TRIGGER IF EXISTS trg_hist_contract_out_inv_item ON public.contract_out_invoice_item;
DROP TRIGGER IF EXISTS trg_hist_contract_in_payable   ON public.contract_in_payable;
DROP TRIGGER IF EXISTS trg_hist_contract_out_progress ON public.contract_out_progress;

-- Hàm trigger tổng quát.
DROP FUNCTION IF EXISTS public.fn_record_history();

-- Bảng lịch sử + index.
DROP TABLE IF EXISTS public.record_history;
