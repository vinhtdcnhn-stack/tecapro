import { pool } from '../db.js'
import { loadGlobalPermissions } from '../auth/permissions.js'

// Quyền RBAC mở bảng điều khiển Kế toán. Ai được cấp quyền này (theo chức danh / phòng ban ở
// trang Phân quyền) thì XEM ĐƯỢC LUÔN SỐ LIỆU — trước đây quyền này chỉ mở được cái vỏ bảng
// còn mọi báo cáo vẫn 403, khiến người dùng thấy bảng trống và tưởng mất dữ liệu.
const ACCOUNTING_DASH_PERM = 'dashboard.accounting.view'

// Cho phép xem báo cáo tài chính: admin, người có quyền RBAC 'dashboard.accounting.view',
// Ban Giám Đốc / Ban Kế Toán, người giữ vị trí GD/PGD, hoặc là thành viên 'Accounting' của
// ≥1 hợp đồng. Danh tính lấy từ req.user (đã qua requireAuth) — KHÔNG tin tham số client.
//
// Các luật cũ (phòng ban / chức danh / thành viên HĐ) GIỮ NGUYÊN bên cạnh quyền RBAC để không
// ai đang xem được bỗng mất quyền khi triển khai.
export async function requireAccountant(req, res, next) {
  if (Number(req.user?.role) === 1) return next()
  try {
    const perms = await loadGlobalPermissions(req.user.id, req.user.role)
    if (perms.includes(ACCOUNTING_DASH_PERM)) return next()

    const { rows } = await pool.query(
      `SELECT 1
         FROM app_user u
         LEFT JOIN department d ON d.id = u.department_id
         LEFT JOIN app_user_position aup ON aup.user_id = u.id
         LEFT JOIN "position" p ON p.id = aup.position_id
         LEFT JOIN "position" p0 ON p0.id = u.position_id
        WHERE u.id = $1
          AND ( d.name IN ('Ban Kế Toán', 'Ban Giám Đốc')
             OR p.code  IN ('GD', 'PGD')
             OR p0.code IN ('GD', 'PGD')
             OR EXISTS (SELECT 1 FROM contract_out_member m
                         WHERE m.user_id = u.id AND m.member_role = 'Accounting') )
        LIMIT 1`,
      [req.user.id],
    )
    if (rows.length) return next()
  } catch (err) {
    console.error('requireAccountant:', err)
    res.status(503).json({ error: 'Hệ thống tạm gián đoạn, vui lòng thử lại.' })
    return
  }
  res.status(403).json({ error: 'Bạn không có quyền xem báo cáo tài chính.' })
}
