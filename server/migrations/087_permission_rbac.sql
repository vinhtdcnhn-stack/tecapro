-- 087_permission_rbac.sql — Module Phân quyền (RBAC 2 lớp).
-- Chỉ tạo CẤU TRÚC. Dữ liệu danh mục `permission` + seed bootstrap do
-- server/auth/seedPermissions.js nạp (đọc thẳng permissionCatalog.js — nguồn-sự-thật-
-- duy-nhất), idempotent, chạy lúc server khởi động và chạy tay được:
--     node server/auth/seedPermissions.js
-- Áp tay file này lên CẢ local lẫn VPS (theo CLAUDE.md), rồi chạy seed.

-- Danh mục quyền (2 lớp). Seed/đồng bộ từ permissionCatalog.js.
CREATE TABLE IF NOT EXISTS permission (
  key         varchar(120) PRIMARY KEY,
  scope       varchar(16)  NOT NULL,                 -- 'global' | 'contract'
  kind        varchar(16)  NOT NULL DEFAULT 'global',-- 'global' | 'tab' | 'section'
  label       varchar(255) NOT NULL,
  group_label varchar(120) NOT NULL,
  admin_only  boolean      NOT NULL DEFAULT false,
  sort_order  integer      NOT NULL DEFAULT 0
);

-- Lớp A — quyền toàn cục neo vào position.
CREATE TABLE IF NOT EXISTS position_permission (
  position_id integer      NOT NULL REFERENCES "position"(id) ON DELETE CASCADE,
  perm_key    varchar(120) NOT NULL REFERENCES permission(key) ON DELETE CASCADE,
  PRIMARY KEY (position_id, perm_key)
);

-- Lớp A — ghi đè theo từng user (deny thắng allow). Chỉ áp cho quyền scope='global'.
CREATE TABLE IF NOT EXISTS user_permission_override (
  user_id  integer      NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  perm_key varchar(120) NOT NULL REFERENCES permission(key) ON DELETE CASCADE,
  effect   varchar(8)   NOT NULL CHECK (effect IN ('allow','deny')),
  PRIMARY KEY (user_id, perm_key)
);

-- Lớp B — quyền theo hợp đồng neo vào contract_out_member.member_role.
CREATE TABLE IF NOT EXISTS contract_role_permission (
  member_role varchar(40)  NOT NULL,                 -- PM/Sale/Presale/Technical/ImportExport/Accounting/Follower
  perm_key    varchar(120) NOT NULL REFERENCES permission(key) ON DELETE CASCADE,
  PRIMARY KEY (member_role, perm_key)
);

CREATE INDEX IF NOT EXISTS idx_position_permission_perm   ON position_permission(perm_key);
CREATE INDEX IF NOT EXISTS idx_user_perm_override_user    ON user_permission_override(user_id);
CREATE INDEX IF NOT EXISTS idx_contract_role_perm_role    ON contract_role_permission(member_role);
