import { pool } from '../db.js'

// ──────────────────────────────────────────────────────────────────────────────
// Báo cáo & thống kê module Đấu thầu (GĐ4). Lọc theo khoảng ngày nộp (from/to).
//   • summary  : số gói, theo kết quả, theo lĩnh vực (count + dự toán), theo tháng.
//   • staff    : hiệu suất người làm thầu (số gói, trúng, tỷ lệ, vòng review TB).
//   • dept     : đóng góp phòng ban chuyên môn (số đầu việc, hoàn thành, đúng hạn).
// ──────────────────────────────────────────────────────────────────────────────

function dateRange(req) {
  const from = String(req.query?.from ?? '').trim() || null
  const to = String(req.query?.to ?? '').trim() || null
  return { from, to }
}

// Điều kiện lọc trên submit_date (an toàn, dùng tham số hoá).
function whereClause(from, to, params, alias = 't') {
  const conds = [`${alias}.is_deleted = false`]
  if (from) { params.push(from); conds.push(`${alias}.submit_date >= $${params.length}`) }
  if (to) { params.push(to); conds.push(`${alias}.submit_date <= $${params.length}`) }
  return conds.join(' AND ')
}

export async function getReports(req, res) {
  const { from, to } = dateRange(req)
  try {
    const p1 = []; const w1 = whereClause(from, to, p1)
    const { rows: totals } = await pool.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE result = 'Trúng')::int AS won,
              count(*) FILTER (WHERE result = 'Trượt')::int AS lost,
              count(*) FILTER (WHERE result = 'Hủy')::int AS cancelled,
              count(*) FILTER (WHERE result IS NULL)::int AS pending,
              COALESCE(SUM(estimate * COALESCE(exchange_rate, 1)), 0) AS total_estimate
         FROM tender t WHERE ${w1}`, p1)

    const p2 = []; const w2 = whereClause(from, to, p2)
    const { rows: byField } = await pool.query(
      `SELECT COALESCE(field, '(Chưa rõ)') AS field, count(*)::int AS count,
              COALESCE(SUM(estimate * COALESCE(exchange_rate, 1)),0) AS estimate
         FROM tender t WHERE ${w2} GROUP BY field ORDER BY count DESC`, p2)

    const p3 = []; const w3 = whereClause(from, to, p3)
    const { rows: byMonth } = await pool.query(
      `SELECT to_char(submit_date, 'YYYY-MM') AS month, count(*)::int AS count,
              count(*) FILTER (WHERE result = 'Trúng')::int AS won,
              COALESCE(SUM(estimate * COALESCE(exchange_rate, 1)),0) AS estimate
         FROM tender t WHERE ${w3} AND submit_date IS NOT NULL
        GROUP BY month ORDER BY month`, p3)

    // Hiệu suất người làm thầu + tổng số vòng review.
    const p4 = []; const w4 = whereClause(from, to, p4)
    const { rows: staff } = await pool.query(
      `SELECT u.id, u.full_name,
              count(DISTINCT t.id)::int AS total,
              count(DISTINCT t.id) FILTER (WHERE t.result = 'Trúng')::int AS won,
              count(r.id)::int AS review_rounds
         FROM tender t
         JOIN app_user u ON u.id = t.bid_maker_id
         LEFT JOIN tender_review r ON r.tender_id = t.id
        WHERE ${w4} GROUP BY u.id, u.full_name ORDER BY total DESC`, p4)

    // Đóng góp phòng ban chuyên môn (đầu việc của các gói trong khoảng lọc).
    const p5 = []; const w5 = whereClause(from, to, p5, 't')
    const { rows: dept } = await pool.query(
      `SELECT COALESCE(d.name, '(Chưa gán)') AS department, count(i.id)::int AS items,
              count(*) FILTER (WHERE i.status = 'Hoàn thành')::int AS done,
              count(*) FILTER (WHERE i.status = 'Hoàn thành' AND i.due_date IS NOT NULL
                AND i.completed_at::date <= i.due_date)::int AS on_time
         FROM tender_checklist_item i
         JOIN tender t ON t.id = i.tender_id
         LEFT JOIN department d ON d.id = i.department_id
        WHERE ${w5} GROUP BY d.name ORDER BY items DESC`, p5)

    res.json({ totals: totals[0], byField, byMonth, staff, dept })
  } catch (err) {
    console.error('getReports:', err)
    res.status(500).json({ error: 'Không thể tải báo cáo.' })
  }
}
