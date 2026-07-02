-- 093_system_page_view_perms.sql
-- Tách quyền XEM riêng cho từng trang danh mục Hệ thống: system.<page>.view
-- (Người dùng / Phòng ban / Vị trí / Khách hàng / Nhà cung cấp / Loại biên bản).
--
-- Trước đây: ai vào được module Hệ thống (module.system.view) là THẤY hết 6 trang ở chế
-- độ chỉ-đọc; system.<page>.manage chỉ mở nút Thêm/Sửa. Nay mỗi trang có thêm .view để
-- ẩn/hiện trang + menu theo từng trang (FE-only, KHÔNG chặn API danh sách vì dropdown
-- KH/NCC/phòng ban... dùng chung khắp app).
--
-- Backfill giữ nguyên hành vi cũ: position nào đang có module.system.view thì được cấp
-- cả 6 quyền .view (vẫn thấy hết như trước). Admin (role==1) fail-open không cần grant.
-- Sau khi áp, admin có thể BỎ tick từng .view ở ma trận để thu hẹp quyền xem.
--
-- Danh mục `permission` tự đồng bộ từ catalog lúc server khởi động (syncPermissionCatalog),
-- migration này CHỈ lo phần dữ liệu grant. CẦN ÁP CẢ LOCAL LẪN VPS.

INSERT INTO position_permission (position_id, perm_key)
SELECT pp.position_id, v.perm_key
  FROM position_permission pp
  CROSS JOIN (VALUES
    ('system.users.view'),
    ('system.departments.view'),
    ('system.positions.view'),
    ('system.customers.view'),
    ('system.suppliers.view'),
    ('system.bbtypes.view')
  ) AS v(perm_key)
 WHERE pp.perm_key = 'module.system.view'
ON CONFLICT DO NOTHING;
