import { pool } from '../db.js'

// Cho phép xem báo cáo tài chính: admin, Ban Giám Đốc / Ban Kế Toán, người giữ vị trí
// GD/PGD, hoặc là thành viên 'Accounting' của ≥1 hợp đồng. Danh tính lấy từ req.user
// (đã qua requireAuth) — KHÔNG tin tham số client.
export async function requireAccountant(req, res, next) {
  if (Number(req.user?.role) === 1) return next()
  try {
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
