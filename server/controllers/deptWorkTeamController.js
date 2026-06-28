import { pool } from '../db.js'
import { DEPT_KT_CO_DIEN, MANAGER_POSITION_IDS } from '../middleware/deptWorkAccess.js'
import { cacheWrap } from '../cache.js'
import { lookupKey } from '../services/cacheKeys.js'

// ──────────────────────────────────────────────────────────────────────────────
// Team (presale/postsale) + danh sách thành viên của module KT Cơ điện.
// Thành viên = nhân sự thuộc phòng (department_id); quản lý suy từ chức danh.
// ──────────────────────────────────────────────────────────────────────────────

const DW_TEAMS_TTL = 24 * 60 * 60  // 24h — không có đường ghi team ở đây, rất ổn định
const DW_MEMBERS_TTL = 6 * 60 * 60 // 6h — đổi user/vị trí đã invalidate 'dw-members' ở authController

export async function getTeams(_req, res) {
  try {
    const rows = await cacheWrap(lookupKey('dw-teams'), DW_TEAMS_TTL, async () => {
      const { rows } = await pool.query(
        `SELECT id, code, name, sort_order
           FROM dept_work_team
          WHERE department_id = $1
          ORDER BY sort_order, id`,
        [DEPT_KT_CO_DIEN],
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getTeams:', err)
    res.status(500).json({ error: 'Không thể tải danh sách nhóm.' })
  }
}

export async function getMembers(_req, res) {
  try {
    // Danh sách người được giao việc = nhân sự đang hoạt động thuộc phòng KT Cơ điện.
    // Quản lý (Trưởng/Phó ban) suy từ chức danh app_user_position, không còn dùng
    // dept_work_member. dept_role trả về chỉ để xếp quản lý lên đầu (UI không phụ thuộc).
    const rows = await cacheWrap(lookupKey('dw-members'), DW_MEMBERS_TTL, async () => {
    const { rows } = await pool.query(
      `SELECT u.id AS user_id, u.full_name,
              CASE WHEN bool_or(ap.position_id = ANY($2::int[]))
                   THEN 'MANAGER' ELSE 'MEMBER' END AS dept_role,
              true AS is_active
         FROM app_user u
         LEFT JOIN app_user_position ap ON ap.user_id = u.id
        WHERE u.department_id = $1 AND u.is_active IS NOT FALSE
        GROUP BY u.id, u.full_name
        ORDER BY CASE WHEN bool_or(ap.position_id = ANY($2::int[])) THEN 0 ELSE 1 END,
                 u.full_name`,
      [DEPT_KT_CO_DIEN, MANAGER_POSITION_IDS],
    )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getMembers:', err)
    res.status(500).json({ error: 'Không thể tải danh sách thành viên.' })
  }
}
