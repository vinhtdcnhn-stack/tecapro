-- 085_app_feedback.sql
-- Góp ý cải thiện phần mềm: mọi người dùng gửi ý kiến trong quá trình sử dụng,
-- admin theo dõi và cập nhật trạng thái xử lý. Hiển thị dưới mục "Nhật ký Telegram"
-- trong trang Hệ thống.
-- Áp bằng tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS app_feedback (
  id          bigserial   PRIMARY KEY,
  user_id     integer     NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  category    varchar(20) NOT NULL DEFAULT 'other',   -- 'ui'|'feature'|'performance'|'bug'|'other'
  content     text        NOT NULL,
  status      varchar(20) NOT NULL DEFAULT 'open',     -- 'open'|'in_progress'|'done'|'rejected'
  admin_note  text,                                    -- phản hồi/ghi chú của admin
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_feedback_created_at ON app_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_feedback_user ON app_feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_app_feedback_status ON app_feedback (status);

-- Ảnh đính kèm cho góp ý (người dùng dán ảnh từ clipboard khi gửi). Tệp lưu ở
-- server/uploads/feedback/<feedback_id>/, file_path lưu tương đối (vd /uploads/...).
CREATE TABLE IF NOT EXISTS app_feedback_image (
  id          bigserial   PRIMARY KEY,
  feedback_id bigint      NOT NULL REFERENCES app_feedback(id) ON DELETE CASCADE,
  file_name   text        NOT NULL,
  file_path   text        NOT NULL,
  file_size   integer,
  mime_type   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_feedback_image_fb ON app_feedback_image (feedback_id);

COMMIT;
