-- 094_department_permission.sql
-- Tầng cấp quyền theo PHÒNG BAN (department_permission) SONG SONG với position_permission:
-- cấp quyền cho cả phòng thì mọi user thuộc phòng đó có (áp cho cả quyền global lẫn quyền
-- hợp đồng, giống hệt cấp theo vị trí). Dùng để "phân quyền VÀO module cho phòng nào".
--
-- Engine hợp thêm grant của phòng vào quyền hiệu lực ở effectiveOwnRaw (server/auth/permissions.js)
-- theo app_user.department_id. UI: tab "Toàn cục (theo phòng ban)" ở trang Phân quyền + khối
-- "Theo phòng ban" trong panel Ctrl+Shift+Q (trang scope=global).
--
-- CHỈ tạo CẤU TRÚC. Danh mục `permission` tự đồng bộ từ catalog lúc server khởi động.
-- CẦN ÁP CẢ LOCAL LẪN VPS. Idempotent.

CREATE TABLE IF NOT EXISTS department_permission (
  department_id integer      NOT NULL REFERENCES department(id) ON DELETE CASCADE,
  perm_key      varchar(120) NOT NULL REFERENCES permission(key) ON DELETE CASCADE,
  PRIMARY KEY (department_id, perm_key)
);
CREATE INDEX IF NOT EXISTS idx_department_permission_perm ON department_permission(perm_key);
