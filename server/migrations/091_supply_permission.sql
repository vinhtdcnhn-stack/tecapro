-- 091_supply_permission.sql — Tách quyền tab "Theo dõi nhập hàng" (co.supply) khỏi
-- tab "Bảng giá" (co.boq). Trước đây tab nhập hàng dùng chung co.boq.view (hiện sidebar)
-- + co.boq.manage (ghi đầu nhập). Giờ có quyền riêng để bật/tắt độc lập như menu khác.
--
-- Danh mục permission (co.supply.view / co.supply.manage) do permissionCatalog.js đồng bộ
-- lúc server khởi động (syncPermissionCatalog). Nhưng seedBootstrap KHÔNG chạy lại trên DB
-- đã có grant → phải sao chép grant hiện có của co.boq sang co.supply để giữ nguyên hành vi.
-- Áp tay lên CẢ local lẫn VPS (theo CLAUDE.md).

-- (0) Chèn sẵn 2 permission row để thỏa FK khi áp migration TRƯỚC khi restart server.
--     (Server restart sẽ upsert lại nhãn/sort_order từ catalog — không sao.)
INSERT INTO permission (key, scope, kind, label, group_label, admin_only, sort_order)
VALUES
  ('co.supply.view',   'contract', 'tab', 'Theo dõi nhập hàng — Xem', 'HĐ bán', false, 0),
  ('co.supply.manage', 'contract', 'tab', 'Theo dõi nhập hàng — Sửa', 'HĐ bán', false, 0)
ON CONFLICT (key) DO NOTHING;

-- (1) Sao chép grant theo vai trò HĐ: ai thấy/sửa được Bảng giá thì cũng thấy/sửa được
--     tab Theo dõi nhập hàng (giữ nguyên hành vi cũ — bootstrap: view=mọi vai trò, manage=PM).
INSERT INTO contract_role_permission (member_role, perm_key)
  SELECT member_role, 'co.supply.view' FROM contract_role_permission WHERE perm_key = 'co.boq.view'
ON CONFLICT DO NOTHING;
INSERT INTO contract_role_permission (member_role, perm_key)
  SELECT member_role, 'co.supply.manage' FROM contract_role_permission WHERE perm_key = 'co.boq.manage'
ON CONFLICT DO NOTHING;

-- (2) Sao chép grant cấp theo VỊ TRÍ (nếu admin đã ghi đè co.boq theo position).
INSERT INTO position_permission (position_id, perm_key)
  SELECT position_id, 'co.supply.view' FROM position_permission WHERE perm_key = 'co.boq.view'
ON CONFLICT DO NOTHING;
INSERT INTO position_permission (position_id, perm_key)
  SELECT position_id, 'co.supply.manage' FROM position_permission WHERE perm_key = 'co.boq.manage'
ON CONFLICT DO NOTHING;
