import { pool } from '../db.js'
import { DEPT_KT_CO_DIEN } from '../middleware/deptWorkAccess.js'

// ──────────────────────────────────────────────────────────────────────────────
// Team (presale/postsale) + thành viên/vai trò của module KT Cơ điện.
// ──────────────────────────────────────────────────────────────────────────────

const VALID_ROLES = new Set(['HEAD', 'DEPUTY', 'MEMBER'])

export async function getTeams(_req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, code, name, sort_order
         FROM dept_work_team
        WHERE department_id = $1
        ORDER BY sort_order, id`,
      [DEPT_KT_CO_DIEN],
    )
    res.json(rows)
  } catch (err) {
    console.error('getTeams:', err)
    res.status(500).json({ error: 'Không thể tải danh sách nhóm.' })
  }
}

export async function getMembers(_req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.user_id, u.full_name, m.team_id, t.code AS team_code,
              t.name AS team_name, m.dept_role, m.is_active
         FROM dept_work_member m
         JOIN app_user u ON u.id = m.user_id
         LEFT JOIN dept_work_team t ON t.id = m.team_id
        WHERE m.department_id = $1
        ORDER BY CASE m.dept_role WHEN 'HEAD' THEN 0 WHEN 'DEPUTY' THEN 1 ELSE 2 END, u.full_name`,
      [DEPT_KT_CO_DIEN],
    )
    res.json(rows)
  } catch (err) {
    console.error('getMembers:', err)
    res.status(500).json({ error: 'Không thể tải danh sách thành viên.' })
  }
}

export async function addMember(req, res) {
  const userId = parseInt(req.body?.user_id)
  const teamId = req.body?.team_id ? parseInt(req.body.team_id) : null
  const deptRole = String(req.body?.dept_role ?? 'MEMBER').toUpperCase()
  if (!userId) return res.status(400).json({ error: 'Thiếu người dùng.' })
  if (!VALID_ROLES.has(deptRole)) return res.status(400).json({ error: 'Vai trò không hợp lệ.' })
  try {
    const { rows } = await pool.query(
      `INSERT INTO dept_work_member (department_id, user_id, team_id, dept_role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, team_id, dept_role, is_active`,
      [DEPT_KT_CO_DIEN, userId, teamId, deptRole],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Người dùng đã là thành viên của phòng.' })
    }
    console.error('addMember:', err)
    res.status(500).json({ error: 'Không thể thêm thành viên.' })
  }
}

export async function updateMember(req, res) {
  const id = parseInt(req.params.id)
  const teamId = req.body?.team_id ? parseInt(req.body.team_id) : null
  const deptRole = String(req.body?.dept_role ?? 'MEMBER').toUpperCase()
  const isActive = req.body?.is_active === undefined ? true : !!req.body.is_active
  if (!VALID_ROLES.has(deptRole)) return res.status(400).json({ error: 'Vai trò không hợp lệ.' })
  try {
    const { rows } = await pool.query(
      `UPDATE dept_work_member
          SET team_id = $1, dept_role = $2, is_active = $3, updated_at = now()
        WHERE id = $4 AND department_id = $5
        RETURNING id, user_id, team_id, dept_role, is_active`,
      [teamId, deptRole, isActive, id, DEPT_KT_CO_DIEN],
    )
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy thành viên.' })
    res.json(rows[0])
  } catch (err) {
    console.error('updateMember:', err)
    res.status(500).json({ error: 'Không thể cập nhật thành viên.' })
  }
}

export async function removeMember(req, res) {
  const id = parseInt(req.params.id)
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM dept_work_member WHERE id = $1 AND department_id = $2',
      [id, DEPT_KT_CO_DIEN],
    )
    if (!rowCount) return res.status(404).json({ error: 'Không tìm thấy thành viên.' })
    res.json({ success: true })
  } catch (err) {
    console.error('removeMember:', err)
    res.status(500).json({ error: 'Không thể xóa thành viên.' })
  }
}
