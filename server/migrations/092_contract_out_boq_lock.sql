-- 092_contract_out_boq_lock.sql — KHÓA bảng giá (BOQ) của HĐ bán.
-- Khi contract_out.boq_locked = true thì CHẶN mọi thao tác thêm/sửa/xóa/sắp xếp/import
-- dòng bảng giá (kể cả admin, kể cả PM) cho tới khi mở khóa. Cơ chế tương tự khóa đợt
-- xuất hóa đơn (078), nhưng khóa ở mức TOÀN BỘ bảng giá của hợp đồng (1 cờ / HĐ).
--
-- Quyền khóa/mở khóa = co.boq.lock — chỉ Trưởng/Phó ban (position code TP/PP) + admin.
-- Mở khóa buộc nhập lại mật khẩu (verifyUserPassword). Áp tay lên CẢ local lẫn VPS.

-- (1) Cột trạng thái khóa trên contract_out.
ALTER TABLE public.contract_out
  ADD COLUMN IF NOT EXISTS boq_locked    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boq_locked_by integer REFERENCES public.app_user(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS boq_locked_at timestamptz;

-- (2) Chèn sẵn permission row để thỏa FK khi áp migration TRƯỚC khi restart server.
--     (Server restart sẽ upsert lại nhãn/sort_order từ permissionCatalog.js — không sao.)
INSERT INTO permission (key, scope, kind, label, group_label, admin_only, sort_order)
VALUES ('co.boq.lock', 'contract', 'tab', 'Bảng giá — Khóa/Mở khóa', 'HĐ bán', false, 0)
ON CONFLICT (key) DO NOTHING;

-- (3) Cấp co.boq.lock theo VỊ TRÍ cho Trưởng/Phó ban (TP/PP). seedBootstrap KHÔNG chạy
--     lại trên DB đã có grant → cấp tay ở đây (giống cách 088 seed dashboard theo mã vị trí).
INSERT INTO position_permission (position_id, perm_key)
  SELECT id, 'co.boq.lock' FROM "position" WHERE is_active = true AND code = ANY(ARRAY['TP','PP'])
ON CONFLICT DO NOTHING;
