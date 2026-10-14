-- 109_contract_view_all_permission.sql — Quyền "Hợp đồng bán — Xem tất cả HĐ (danh sách)".
-- Trước đây người không phải admin chỉ thấy HĐ bán mình là thành viên (contract_out_member),
-- dù đã có quyền vào module. Nay vị trí/phòng ban có module.contracts.view_all thấy TẤT CẢ HĐ
-- ở danh sách /qlda như admin. Chỉ mở rộng phạm vi XEM danh sách; tab chi tiết vẫn theo quyền
-- lớp B (vai trò HĐ hoặc quyền HĐ cấp theo vị trí), ghi vẫn theo vai trò HĐ.
--
-- Danh mục `permission` tự đồng bộ từ catalog lúc server khởi động; INSERT để dòng tồn tại
-- trước khi restart. MẶC ĐỊNH không cấp cho ai — admin tự tick trong ma trận. CẦN ÁP LOCAL + VPS.

INSERT INTO permission (key, scope, kind, label, group_label, admin_only, sort_order)
VALUES ('module.contracts.view_all', 'global', 'global',
        'Hợp đồng bán — Xem tất cả HĐ (danh sách)', 'Vào module', false, 0)
ON CONFLICT (key) DO NOTHING;
