import { pool } from '../db.js'
import { vnToday } from '../utils/reportLoaders.js'
import { overdueTasksAsOf } from '../utils/reportLoaders.asof.js'

// GET /reports/overdue-tasks
// Công việc QUÁ HẠN toàn hệ thống cho dashboard điều hành (đọc-only, gating requireAccountant).
// Overdue = due_date < hôm nay (giờ VN) AND status chưa kết thúc ('Hoàn thành'/'Hủy').
// Bỏ qua HĐ đã xóa. Sắp xếp theo số ngày trễ giảm dần.
// Khi request có asOf rõ ràng (xem tại 1 thời điểm quá khứ) → dựng theo TRẠNG THÁI tại
// asOf từ record_history (overdueTasksAsOf), không dùng status hiện tại.
export async function getOverdueTasks(req, res) {
  try {
    const explicitAsOf = /^\d{4}-\d{2}-\d{2}$/.test(req.query.asOf) ? req.query.asOf : null
    if (explicitAsOf) {
      const rows = await overdueTasksAsOf(explicitAsOf, pool)
      return res.json({ asOf: explicitAsOf, count: rows.length, rows })
    }
    const asOf = vnToday()
    const { rows } = await pool.query(`
      SELECT
        t.id,
        t.contract_out_id,
        c.contract_no,
        c.project_name,
        cu.name AS customer_name,
        t.title,
        d.name  AS department_name,
        u.full_name AS assigned_to_name,
        t.priority,
        t.status,
        t.due_date,
        ($1::date - t.due_date) AS days_overdue
      FROM contract_task t
      JOIN contract_out c ON c.id = t.contract_out_id AND COALESCE(c.is_deleted, false) = false
      LEFT JOIN customer  cu ON cu.id = c.customer_id
      LEFT JOIN department d  ON d.id  = t.department_id
      LEFT JOIN app_user   u  ON u.id  = t.assigned_to
      WHERE t.due_date IS NOT NULL
        AND t.due_date < $1::date
        AND t.status NOT IN ('Hoàn thành', 'Hủy')
      ORDER BY days_overdue DESC, t.due_date
    `, [asOf])

    res.json({ asOf, count: rows.length, rows })
  } catch (err) {
    console.error('getOverdueTasks:', err)
    res.status(500).json({ error: 'Không thể tải báo cáo công việc quá hạn.' })
  }
}
