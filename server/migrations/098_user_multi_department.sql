-- 098_user_multi_department.sql
-- Cho phép MỘT người thuộc NHIỀU ban/phòng (kiêm nhiệm) — CHỈ ẢNH HƯỞNG PHÂN QUYỀN (RBAC).
--
-- Trước đây mỗi user chỉ có app_user.department_id (một phòng duy nhất). Nay thêm bảng
-- nhiều-nhiều app_user_department (giống app_user_position cho vị trí) để lưu các ban KIÊM
-- NHIỆM. app_user.department_id VẪN là "phòng CHÍNH" (dùng cho hiển thị, bộ lọc, và các
-- module theo phòng — deptwork/dashboard/đấu thầu — KHÔNG đổi).
--
-- Engine phân quyền (server/auth/permissions.js) coi user "thuộc phòng D" nếu
--   D = app_user.department_id  HOẶC  (user_id, D) ∈ app_user_department.
-- → hợp thêm department_permission của MỌI ban, và nếu là TP/PP thì kế thừa quyền thành
--   viên của MỌI ban user thuộc.
--
-- CHỈ tạo CẤU TRÚC. CẦN ÁP CẢ LOCAL LẪN VPS. Idempotent.

CREATE TABLE IF NOT EXISTS app_user_department (
  user_id       integer NOT NULL REFERENCES app_user(id)   ON DELETE CASCADE,
  department_id integer NOT NULL REFERENCES department(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, department_id)
);
CREATE INDEX IF NOT EXISTS idx_app_user_department_dept ON app_user_department(department_id);
