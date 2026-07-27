-- 102: Ẩn/hiện số tiền trên dòng HỆ THỐNG (nhóm) của bảng giá HĐ bán.
-- Chỉ ảnh hưởng HIỂN THỊ: số tiền roll-up vẫn được tính và vẫn cộng vào tổng hợp đồng,
-- chỉ không hiện trên chính dòng hệ thống đó (dòng con vẫn hiện bình thường).

ALTER TABLE public.contract_out_boq
  ADD COLUMN IF NOT EXISTS hide_amount boolean NOT NULL DEFAULT false;
