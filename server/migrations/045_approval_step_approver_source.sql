-- 045_approval_step_approver_source.sql
-- Mở rộng bước duyệt: mỗi bước có "nguồn người duyệt" (approver_source):
--   'fixed'          — admin chọn sẵn một/vài người (dùng approval_form_step_approver)
--   'direct_manager' — quản lý trực tiếp của người gửi (lấy app_user.manager_id lúc gửi)
--   'requester_pick' — người gửi tự chọn khi lập đề xuất
-- Áp bằng tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

ALTER TABLE approval_form_step
  ADD COLUMN IF NOT EXISTS approver_source varchar(20) NOT NULL DEFAULT 'fixed';

-- Snapshot lại nguồn vào bước-instance để hiển thị/đối chiếu về sau.
ALTER TABLE approval_request_step
  ADD COLUMN IF NOT EXISTS approver_source varchar(20) NOT NULL DEFAULT 'fixed';

COMMIT;
