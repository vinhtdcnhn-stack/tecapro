import { pool } from '../db.js'

// Nguyên liệu dùng chung cho các middleware phân quyền hợp đồng. Tách khỏi contractAccess.js
// để file đó (và contractInAccess.js) giữ dưới 500 dòng, đồng thời tránh vòng import: file
// này KHÔNG import ngược lên hai file kia.

// Id hợp lệ = chuỗi toàn chữ số (chặn injection qua param/body trước khi đưa vào SQL).
export const ID_RE = /^\d+$/

// Chuẩn hoá id (1 hoặc mảng) → mảng chuỗi số; null nếu có phần tử không phải id hợp lệ.
export function toIdList(raw) {
  const arr = Array.isArray(raw) ? raw : [raw]
  if (!arr.length) return null
  const out = []
  for (const v of arr) {
    const s = String(v ?? '').trim()
    if (!ID_RE.test(s)) return null
    out.push(s)
  }
  return out
}

// roles = các member_role được phép ghi (mặc định chỉ 'PM'). Admin luôn toàn quyền.
// resolverSql (tuỳ chọn) nhận $1 = mảng id con, trả về contract_out_id tương ứng.
export function makeGuard(pick, resolverSql, roles = ['PM']) {
  const roleLabel = roles.includes('Technical') ? 'PM/Kỹ thuật của hợp đồng' : 'PM của hợp đồng'
  return async function pmGuard(req, res, next) {
    try {
      if (Number(req.user?.role) === 1) return next() // admin: toàn quyền

      const ids = toIdList(pick(req))
      if (!ids) {
        res.status(400).json({ error: 'Tham số id không hợp lệ.' })
        return
      }

      let contractIds = ids
      if (resolverSql) {
        const { rows } = await pool.query(resolverSql, [ids])
        contractIds = rows.map(r => r.contract_out_id).filter(v => v != null).map(String)
        if (!contractIds.length) {
          res.status(404).json({ error: 'Không tìm thấy dữ liệu.' })
          return
        }
      }

      // User phải có 1 trong các vai trò cho phép ở TẤT CẢ hợp đồng liên quan
      // (bulk có thể chạm nhiều HĐ).
      const distinct = [...new Set(contractIds)]
      const { rows: m } = await pool.query(
        `SELECT COUNT(DISTINCT contract_out_id)::int AS n
           FROM contract_out_member
          WHERE user_id = $1 AND member_role = ANY($2) AND contract_out_id = ANY($3::bigint[])`,
        [req.user.id, roles, distinct],
      )
      if (m[0].n === distinct.length) return next()

      res.status(403).json({ error: `Chỉ ${roleLabel} (hoặc admin) mới được sửa đổi dữ liệu này.` })
    } catch (err) {
      next(err)
    }
  }
}

export async function isPmOfContract(userId, contractId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM contract_out_member
      WHERE user_id = $1 AND member_role = 'PM' AND contract_out_id = $2 LIMIT 1`,
    [userId, contractId],
  )
  return rows.length > 0
}

// Đếm số HĐ bán mà user giữ vai trò `role` trong tập contract_out_id cho trước.
export async function countMemberRole(userId, role, contractIds) {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT contract_out_id)::int AS n FROM contract_out_member
      WHERE user_id = $1 AND member_role = $2 AND contract_out_id = ANY($3::bigint[])`,
    [userId, role, contractIds],
  )
  return rows[0].n
}
