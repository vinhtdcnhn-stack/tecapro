-- 088_dashboard_permissions.sql — Đưa các BẢNG ĐIỀU KHIỂN trang chủ vào RBAC (Lớp A).
--
-- Trước đây bảng nào hiện ở Trang chủ do gating CỨNG theo vị trí/phòng ban trong
-- src/lib/useHomeDashboards.js, KHÔNG có trong ma trận phân quyền. Nay mỗi bảng là một
-- quyền dashboard.*.view (neo position), tick được ở trang Phân quyền.
--
-- Danh mục `permission` vốn được server/auth/seedPermissions.js đồng bộ lúc khởi động
-- (đọc permissionCatalog.js). Nhưng seedBootstrap CHỈ chạy lần đầu (khi chưa có grant),
-- nên với DB đang chạy phải cấp grant mặc định BẰNG TAY ở đây để giữ đúng hành vi cũ.
-- Chèn dòng `permission` trước (vì position_permission FK tới permission.key), rồi grant.
-- Áp tay file này lên CẢ local lẫn VPS (theo CLAUDE.md). Idempotent (ON CONFLICT DO NOTHING).

-- 1) Danh mục quyền dashboard (server sẽ upsert lại label/sort_order khi khởi động).
INSERT INTO permission (key, scope, kind, label, group_label, admin_only, sort_order) VALUES
  ('dashboard.pm.view',         'global', 'global', 'Tiến độ dự án',       'Bảng điều khiển', false, 6),
  ('dashboard.director.view',   'global', 'global', 'Tổng quan hệ thống',  'Bảng điều khiển', false, 7),
  ('dashboard.accounting.view', 'global', 'global', 'Kế toán',             'Bảng điều khiển', false, 8),
  ('dashboard.tender.view',     'global', 'global', 'Kế hoạch đấu thầu',   'Bảng điều khiển', false, 9),
  ('dashboard.dept.view',       'global', 'global', 'Việc của phòng',      'Bảng điều khiển', false, 10),
  ('dashboard.assignee.view',   'global', 'global', 'Việc của tôi',        'Bảng điều khiển', false, 11),
  ('dashboard.unread.view',     'global', 'global', 'Chưa đọc',            'Bảng điều khiển', false, 12)
ON CONFLICT (key) DO NOTHING;

-- 2) Grant mặc định = đúng quy tắc gating cũ.

-- 2a) "Việc của tôi" + "Chưa đọc": luôn-có → mọi vị trí đang hoạt động.
INSERT INTO position_permission (position_id, perm_key)
  SELECT p.id, k.perm
    FROM "position" p
    CROSS JOIN (VALUES ('dashboard.assignee.view'), ('dashboard.unread.view')) AS k(perm)
   WHERE p.is_active
ON CONFLICT DO NOTHING;

-- 2b) Theo MÃ vị trí: pm→PM_TEAM, dept→TP/PP, director→GD/PGD/TQ_TEAM,
--     accounting→GD/PGD/KT_DASH. (TQ_TEAM/KT_DASH là vị trí tạo sẵn cho dashboard,
--     trước đây chưa nối được — nay nối đúng mục đích.)
INSERT INTO position_permission (position_id, perm_key)
  SELECT p.id, g.perm
    FROM "position" p
    JOIN (VALUES
      ('PM_TEAM', 'dashboard.pm.view'),
      ('TP',      'dashboard.dept.view'),
      ('PP',      'dashboard.dept.view'),
      ('GD',      'dashboard.director.view'),
      ('PGD',     'dashboard.director.view'),
      ('TQ_TEAM', 'dashboard.director.view'),
      ('GD',      'dashboard.accounting.view'),
      ('PGD',     'dashboard.accounting.view'),
      ('KT_DASH', 'dashboard.accounting.view')
    ) AS g(code, perm) ON g.code = p.code
   WHERE p.is_active
ON CONFLICT DO NOTHING;

-- 2c) Theo PHÒNG BAN (vị trí có ≥1 user thuộc phòng): accounting→Ban Kế Toán (dept 2),
--     tender→Ban Kế hoạch Đấu thầu (dept 9). Gộp cột legacy app_user.position_id.
INSERT INTO position_permission (position_id, perm_key)
  SELECT DISTINCT up.position_id, g.perm
    FROM (
      SELECT user_id, position_id FROM app_user_position
      UNION
      SELECT id, position_id FROM app_user WHERE position_id IS NOT NULL
    ) up
    JOIN app_user u ON u.id = up.user_id
    JOIN (VALUES (2, 'dashboard.accounting.view'), (9, 'dashboard.tender.view')) AS g(dept, perm)
      ON g.dept = u.department_id
   WHERE up.position_id IS NOT NULL
ON CONFLICT DO NOTHING;
