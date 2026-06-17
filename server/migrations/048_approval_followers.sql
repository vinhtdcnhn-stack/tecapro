-- 048_approval_followers.sql
-- "Người theo dõi" cho module Đề xuất / Phê duyệt.
-- Admin cấu hình sẵn 1 hoặc nhiều người theo dõi cho TỪNG loại đơn (template).
-- Khi đơn được GỬI, danh sách này được CHỤP (snapshot) vào đơn — người gửi KHÔNG
-- chọn/sửa được. Người theo dõi được XEM đơn và NHẬN thông báo về diễn biến đơn.
-- Áp bằng tay qua psql (local + VPS). KHÔNG chạy lại schema.sql.

BEGIN;

-- ── Người theo dõi cấu hình cho loại đơn (template) ───────────────────────────
CREATE TABLE IF NOT EXISTS approval_form_follower (
  id       bigserial PRIMARY KEY,
  form_id  bigint  NOT NULL REFERENCES approval_form(id) ON DELETE CASCADE,
  user_id  integer NOT NULL REFERENCES app_user(id),
  UNIQUE (form_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_aff_follower_form ON approval_form_follower(form_id);

-- ── Người theo dõi SNAPSHOT của từng đơn ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_request_follower (
  id          bigserial PRIMARY KEY,
  request_id  bigint  NOT NULL REFERENCES approval_request(id) ON DELETE CASCADE,
  user_id     integer NOT NULL REFERENCES app_user(id),
  UNIQUE (request_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_arf_follower_request ON approval_request_follower(request_id);

COMMIT;
