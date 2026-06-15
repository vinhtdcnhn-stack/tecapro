import { pool } from '../db.js'
import { DEPT_KT_CO_DIEN, userIsHeadOrDeputy } from '../middleware/deptWorkAccess.js'

// ──────────────────────────────────────────────────────────────────────────────
// Nhật ký công việc hằng ngày (dept_work_log) + báo cáo năng lực (capacity).
// Năng lực tính theo GIỜ CÔNG: tổng giờ, ngày ghi, giờ TB/ngày, việc chạm tới,
// việc hoàn thành trong kỳ, tỷ lệ sử dụng = tổng giờ / (8 × số ngày công).
// Gác quyền ở route (isDeptMember đọc/ghi của mình · isLogOwner sửa/xóa).
// ──────────────────────────────────────────────────────────────────────────────

const DONE = 'Hoàn thành'

// Buổi làm hợp lệ và quy đổi giờ công (mỗi buổi = 4 giờ).
const SHIFT_KEYS = ['dem_truoc', 'sang', 'chieu', 'toi']
const SHIFT_LABELS = { dem_truoc: 'Đêm hôm trước', sang: 'Sáng', chieu: 'Chiều', toi: 'Buổi tối' }
const SHIFT_HOURS = 4

// Chuẩn hóa danh sách buổi từ client: lọc giá trị hợp lệ, bỏ trùng, giữ thứ tự chuẩn.
function parseShifts(v) {
  const set = new Set(Array.isArray(v) ? v : [])
  return SHIFT_KEYS.filter(k => set.has(k))
}

// Chặn ghi 2 việc khác nhau vào cùng một khung giờ trong ngày.
// Trả về message lỗi nếu trùng, ngược lại null. excludeId: bỏ qua chính dòng đang sửa.
async function shiftClashError(userId, logDate, shifts, excludeId = null) {
  if (!shifts.length) return null
  const { rows } = await pool.query(
    `SELECT shifts FROM dept_work_log
      WHERE user_id = $1 AND log_date = $2 AND shifts && $3::text[]
        AND ($4::bigint IS NULL OR id <> $4)`,
    [userId, logDate, shifts, excludeId],
  )
  if (!rows.length) return null
  const taken = new Set(rows.flatMap(r => r.shifts || []))
  const dup = shifts.filter(s => taken.has(s)).map(s => SHIFT_LABELS[s] || s)
  return `Khung giờ "${dup.join(', ')}" trong ngày đã có nhật ký khác. `
       + 'Nhiều việc trong cùng một buổi phải ghi chung vào một mô tả công việc.'
}

// Mặc định khoảng ngày = tháng hiện tại nếu thiếu tham số.
function range(req) {
  const today = new Date()
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const iso = (d) => d.toISOString().slice(0, 10)
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from || '') ? req.query.from : iso(firstOfMonth)
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to || '') ? req.query.to : iso(today)
  return { from, to }
}

// GET /dept-work/logs?user_id=&from=&to=
// Thành viên thường chỉ xem nhật ký của chính mình; head/deputy/admin xem ai cũng được.
export async function getLogs(req, res) {
  const { from, to } = range(req)
  try {
    const canSeeOthers = await userIsHeadOrDeputy(req.user.id, req.user.role)
    const requested = parseInt(req.query.user_id)
    const targetUser = (canSeeOthers && requested) ? requested : req.user.id

    const { rows } = await pool.query(
      `SELECT l.id, l.user_id, u.full_name AS user_name, l.log_date, l.task_id,
              t.title AS task_title, l.description, l.effort_hours, l.shifts,
              l.created_at, l.updated_at
         FROM dept_work_log l
         LEFT JOIN app_user u ON u.id = l.user_id
         LEFT JOIN dept_work_task t ON t.id = l.task_id
        WHERE l.user_id = $1 AND l.log_date BETWEEN $2 AND $3
        ORDER BY l.log_date DESC, l.created_at DESC`,
      [targetUser, from, to],
    )
    res.json(rows)
  } catch (err) {
    console.error('deptWork getLogs:', err)
    res.status(500).json({ error: 'Không thể tải nhật ký công việc.' })
  }
}

// POST /dept-work/logs  { log_date, task_id?, description, shifts[] }
// Luôn ghi cho chính người đăng nhập. effort_hours = số buổi × 4 (tính ở server).
export async function addLog(req, res) {
  const b = req.body || {}
  const description = b.description?.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.log_date || '')) return res.status(400).json({ error: 'Ngày không hợp lệ.' })
  if (!description) return res.status(400).json({ error: 'Mô tả công việc không được để trống.' })
  const shifts = parseShifts(b.shifts)
  try {
    const clash = await shiftClashError(req.user.id, b.log_date, shifts)
    if (clash) return res.status(409).json({ error: clash })
    const { rows } = await pool.query(
      `INSERT INTO dept_work_log (user_id, log_date, task_id, description, shifts, effort_hours)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, b.log_date, b.task_id || null, description, shifts, shifts.length * SHIFT_HOURS],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('deptWork addLog:', err)
    res.status(500).json({ error: 'Không thể lưu nhật ký.' })
  }
}

// PUT /dept-work/logs/:id  { log_date?, task_id?, description?, shifts? } — isLogOwner gác.
export async function updateLog(req, res) {
  const id = parseInt(req.params.id)
  const b = req.body || {}
  const description = b.description?.trim()
  if (b.log_date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(b.log_date || '')) {
    return res.status(400).json({ error: 'Ngày không hợp lệ.' })
  }
  if (b.description !== undefined && !description) {
    return res.status(400).json({ error: 'Mô tả công việc không được để trống.' })
  }
  // shifts gửi lên thì cập nhật cả buổi lẫn giờ công; không gửi thì giữ nguyên.
  const shifts = b.shifts !== undefined ? parseShifts(b.shifts) : null
  try {
    if (shifts) {
      // Ngày hiệu lực: ưu tiên ngày mới gửi lên, không có thì lấy ngày hiện tại của dòng.
      let logDate = b.log_date
      if (!logDate) {
        const cur = await pool.query('SELECT log_date FROM dept_work_log WHERE id = $1', [id])
        logDate = cur.rows[0]?.log_date
      }
      const clash = await shiftClashError(req.user.id, logDate, shifts, id)
      if (clash) return res.status(409).json({ error: clash })
    }
    const { rows } = await pool.query(
      `UPDATE dept_work_log SET
         log_date     = COALESCE($2, log_date),
         task_id      = $3,
         description  = COALESCE($4, description),
         shifts       = COALESCE($5, shifts),
         effort_hours = COALESCE($6, effort_hours),
         updated_at   = now()
       WHERE id = $1 RETURNING *`,
      [id, b.log_date || null, b.task_id || null, description || null,
       shifts, shifts !== null ? shifts.length * SHIFT_HOURS : null],
    )
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy nhật ký.' })
    res.json(rows[0])
  } catch (err) {
    console.error('deptWork updateLog:', err)
    res.status(500).json({ error: 'Không thể cập nhật nhật ký.' })
  }
}

// DELETE /dept-work/logs/:id — isLogOwner gác.
export async function deleteLog(req, res) {
  try {
    const { rowCount } = await pool.query('DELETE FROM dept_work_log WHERE id = $1', [parseInt(req.params.id)])
    if (!rowCount) return res.status(404).json({ error: 'Không tìm thấy nhật ký.' })
    res.json({ success: true })
  } catch (err) {
    console.error('deptWork deleteLog:', err)
    res.status(500).json({ error: 'Không thể xóa nhật ký.' })
  }
}

// GET /dept-work/capacity?from=&to=&team_id=
// Head/deputy/admin: tất cả (lọc theo team nếu có). Thành viên: chỉ chính mình.
export async function getCapacity(req, res) {
  const { from, to } = range(req)
  // Nhóm presale/postsale suy từ vị trí (app_user_position), không quản lý riêng.
  const segment = ['PRESALE', 'POSTSALE'].includes(req.query.segment) ? req.query.segment : null
  try {
    const canSeeAll = await userIsHeadOrDeputy(req.user.id, req.user.role)
    const onlyUser = canSeeAll ? null : req.user.id

    const { rows } = await pool.query(
      `WITH wd AS (
         SELECT count(*)::int AS days
           FROM generate_series($1::date, $2::date, interval '1 day') d
          WHERE extract(isodow FROM d) < 6
       ),
       roster AS (
         SELECT m.user_id, u.full_name, m.dept_role,
                NULLIF(concat_ws(', ',
                  MAX(CASE WHEN p.code = 'PRESALE'  THEN 'Presale'  END),
                  MAX(CASE WHEN p.code = 'POSTSALE' THEN 'Postsale' END)
                ), '') AS team_name
           FROM dept_work_member m
           JOIN app_user u ON u.id = m.user_id
           LEFT JOIN app_user_position up ON up.user_id = m.user_id
           LEFT JOIN position p ON p.id = up.position_id AND p.code IN ('PRESALE', 'POSTSALE')
          WHERE m.department_id = $3 AND m.is_active
            AND ($5::int IS NULL OR m.user_id = $5)
          GROUP BY m.user_id, u.full_name, m.dept_role
         HAVING $4::text IS NULL OR bool_or(p.code = $4)
       ),
       logs AS (
         SELECT user_id,
                SUM(effort_hours) AS total_hours,
                COUNT(DISTINCT log_date) AS days_logged,
                COUNT(DISTINCT task_id) FILTER (WHERE task_id IS NOT NULL) AS tasks_touched
           FROM dept_work_log
          WHERE log_date BETWEEN $1 AND $2
          GROUP BY user_id
       ),
       done AS (
         SELECT a.assignee_id AS user_id, COUNT(DISTINCT t.id) AS completed_tasks
           FROM dept_work_task t
           JOIN dept_work_assignment a ON a.task_id = t.id AND a.is_active
          WHERE t.status = $6 AND t.completed_at::date BETWEEN $1 AND $2
          GROUP BY a.assignee_id
       )
       SELECT r.user_id, r.full_name, r.team_name, r.dept_role,
              COALESCE(l.total_hours, 0)::numeric AS total_hours,
              COALESCE(l.days_logged, 0)::int     AS days_logged,
              COALESCE(l.tasks_touched, 0)::int   AS tasks_touched,
              COALESCE(d.completed_tasks, 0)::int AS completed_tasks,
              (SELECT days FROM wd)               AS working_days
         FROM roster r
         LEFT JOIN logs l ON l.user_id = r.user_id
         LEFT JOIN done d ON d.user_id = r.user_id
        ORDER BY COALESCE(l.total_hours, 0) DESC, r.full_name`,
      [from, to, DEPT_KT_CO_DIEN, segment, onlyUser, DONE],
    )

    const result = rows.map(r => {
      const totalHours = Number(r.total_hours)
      const daysLogged = Number(r.days_logged)
      const workingDays = Number(r.working_days)
      const capacityHours = workingDays * 8
      return {
        ...r,
        total_hours: totalHours,
        avg_hours_per_day: daysLogged ? Math.round((totalHours / daysLogged) * 10) / 10 : 0,
        utilization: capacityHours ? Math.round((totalHours / capacityHours) * 1000) / 10 : 0,
      }
    })
    res.json({ from, to, working_days: rows[0]?.working_days ?? 0, rows: result })
  } catch (err) {
    console.error('deptWork getCapacity:', err)
    res.status(500).json({ error: 'Không thể tính báo cáo năng lực.' })
  }
}
