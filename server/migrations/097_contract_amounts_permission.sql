-- 097_contract_amounts_permission.sql — Tách quyền XEM GIÁ TRỊ TIỀN ở DANH SÁCH HĐ bán
-- (/qlda) ra khỏi quyền vào module. Trước đây ai vào được trang HĐ bán là thấy luôn các
-- cột Trước VAT / Sau VAT / USD + card "Tổng giá trị". Nay:
--   • module.contracts.view    → vào trang, THẤY danh sách nhưng KHÔNG có cột tiền.
--   • module.contracts.amounts → thêm quyền để thấy mọi cột tiền (requires .view).
--
-- Danh mục `permission` tự đồng bộ từ catalog lúc server khởi động (syncPermissionCatalog);
-- INSERT dưới đây chỉ để dòng permission tồn tại TRƯỚC khi restart (thỏa FK nếu cấp grant tay).
--
-- MẶC ĐỊNH: KHÔNG cấp cho vị trí/phòng ban nào — chỉ admin (role==1, fail-open) thấy tiền.
-- Admin tự tick "Hợp đồng bán — Xem giá trị tiền" trong ma trận phân quyền (/qlda, Ctrl+Shift+Q
-- hoặc Hệ thống → Phân quyền) cho những vị trí cần xem. CẦN ÁP CẢ LOCAL LẪN VPS.

INSERT INTO permission (key, scope, kind, label, group_label, admin_only, sort_order)
VALUES ('module.contracts.amounts', 'global', 'global',
        'Hợp đồng bán — Xem giá trị tiền (danh sách)', 'Vào module', false, 0)
ON CONFLICT (key) DO NOTHING;
