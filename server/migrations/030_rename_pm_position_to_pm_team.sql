-- Đổi tên vị trí "PM" (quản lý người dùng) thành "PM TEAM" để tránh nhầm lẫn
-- với vai trò "PM" của thành viên trong từng hợp đồng (contract_out_member.member_role).
--
-- Người dùng liên kết với vị trí qua position_id (app_user_position), nên việc đổi
-- tên/mã ở đây tự động áp dụng cho TẤT CẢ user đang giữ vị trí này — không cần
-- gán lại từng người.
--
-- Phân quyền của vị trí này được kiểm tra theo code (xem ContractListPage.jsx:
-- p.code === 'PM_TEAM'), nên code cũng được đổi theo cho nhất quán.
UPDATE "position" SET code = 'PM_TEAM', name = 'PM TEAM' WHERE code = 'PM';
