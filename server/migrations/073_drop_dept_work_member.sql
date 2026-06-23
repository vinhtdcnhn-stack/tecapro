-- 073: Gỡ bảng dept_work_member (module Công việc — Ban KT Cơ điện).
-- Module không còn dùng bảng thành viên riêng:
--   • Danh sách thành viên lấy theo app_user.department_id (= 7).
--   • Quyền quản lý (tạo/giao/sửa/xóa việc) suy từ chức danh app_user_position
--     (Trưởng ban / Phó ban), không còn theo dept_work_member.dept_role.
-- Bảng + cột dept_role đã thành dead code → drop hẳn.
DROP TABLE IF EXISTS dept_work_member;
