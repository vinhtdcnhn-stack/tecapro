-- F-05: vô hiệu hoá token cũ khi đổi mật khẩu.
-- Mỗi user có token_version; token phiên nhúng giá trị này (claim `tv`).
-- Đổi mật khẩu → token_version + 1 → mọi token cũ bị từ chối ở requireAuth.
ALTER TABLE app_user ADD COLUMN token_version integer NOT NULL DEFAULT 0;
