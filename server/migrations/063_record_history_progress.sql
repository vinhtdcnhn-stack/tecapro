-- Bổ sung contract_out_progress vào record_history (migration 062) để báo cáo "Xem tại
-- 1 thời điểm" dựng lại được hạn thu của khoản phải thu NEO THEO MỐC BIÊN BẢN tại asOf.
-- Trước đây loadProgressByContract() luôn đọc tiến độ biên bản hiện tại, nên báo cáo
-- công nợ phải thu quá khứ có thể lệch hạn/tình trạng quá hạn nếu mốc biên bản bị
-- nhập/sửa sau ngày asOf. Xem server/utils/reportLoaders.asof.js (loadProgressByContractAsOf).

DROP TRIGGER IF EXISTS trg_hist_contract_out_progress ON public.contract_out_progress;

CREATE TRIGGER trg_hist_contract_out_progress
  AFTER INSERT OR UPDATE OR DELETE ON public.contract_out_progress
  FOR EACH ROW EXECUTE FUNCTION public.fn_record_history();

-- Backfill baseline: 1 snapshot 'I' / hàng, valid_from = thời điểm tạo gần nhất ước
-- lượng được. Bỏ qua nếu bảng đã có lịch sử (chạy lại an toàn).
INSERT INTO public.record_history(table_name, row_id, op, data, valid_from)
SELECT 'contract_out_progress', t.id, 'I', to_jsonb(t),
       COALESCE(t.created_at::timestamptz, now())
  FROM public.contract_out_progress t
 WHERE NOT EXISTS (SELECT 1 FROM public.record_history h WHERE h.table_name = 'contract_out_progress');
