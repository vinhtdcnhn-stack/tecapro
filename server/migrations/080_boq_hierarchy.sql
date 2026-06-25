-- Bảng giá HĐ bán phân cấp: cho phép cây Zone (Phần) > nhóm tổng hợp > dòng có giá,
-- để bảng giá phức tạp (cùng thiết bị lặp ở nhiều phân khu) không còn bị coi là "trùng".
--   parent_id : cha trong cây (NULL = cấp cao nhất). Xoá cha → xoá cả cây con (CASCADE).
--   row_kind  : vai trò của dòng
--     'leaf'  = dòng có đơn giá (nhập SL × đơn giá; CHỈ dòng này xuất hóa đơn/theo dõi tồn)
--     'group' = nhánh tổng hợp (thành tiền = SUM con; có thể giữ ĐVT/SL mô tả)
--     'zone'  = dải phân vùng/tiêu đề (Phần 1/2/3), không số liệu
-- Dòng cũ mặc định 'leaf' + parent_id NULL → bảng phẳng y như trước, KHÔNG cần convert.
ALTER TABLE public.contract_out_boq
  ADD COLUMN IF NOT EXISTS parent_id bigint
    REFERENCES public.contract_out_boq(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS row_kind varchar(10) NOT NULL DEFAULT 'leaf';

CREATE INDEX IF NOT EXISTS ix_boq_parent ON public.contract_out_boq(parent_id);
