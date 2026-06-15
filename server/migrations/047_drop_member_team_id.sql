-- Nhóm presale/postsale của một người giờ suy từ vị trí (app_user_position),
-- không quản lý riêng trong module nữa. Cột team_id trên thành viên thành thừa.
-- (Bảng dept_work_team vẫn giữ vì dept_work_task.team_id còn dùng để phân loại việc.)
DROP INDEX IF EXISTS idx_dwm_team;
ALTER TABLE dept_work_member DROP COLUMN IF EXISTS team_id;
