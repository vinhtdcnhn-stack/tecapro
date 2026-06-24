import { pool } from '../db.js'
import { sendTelegramToMany } from './telegram.js'
import { DEPT_KT_CO_DIEN, MANAGER_POSITION_IDS } from '../middleware/deptWorkAccess.js'

// ──────────────────────────────────────────────────────────────────────────────
// Thông báo Telegram cho module Quản lý công việc — KT Cơ điện.
// Phần lõi (chatIdsForUsers/notifyUsers) đã chuyển sang services/notify.js dùng
// chung; file này chỉ giữ phần riêng của phòng (gửi cho trưởng/phó phòng + tra tên).
// ──────────────────────────────────────────────────────────────────────────────

export { notifyUsers } from './notify.js'

// Gửi tới toàn bộ trưởng/phó phòng KT Cơ điện (dùng cho escalation / báo vấn đề).
// Trưởng/phó xác định theo chức danh (Trưởng/Phó ban), không còn theo dept_work_member.
export async function notifyHeads(text) {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT u.telegram_chat_id
         FROM app_user u
         JOIN app_user_position ap ON ap.user_id = u.id
        WHERE u.department_id = $1
          AND ap.position_id = ANY($2::int[])
          AND u.telegram_chat_id IS NOT NULL`,
      [DEPT_KT_CO_DIEN, MANAGER_POSITION_IDS],
    )
    // Gửi lần lượt từng trưởng/phó phòng cách nhau 3s (không gửi đồng loạt).
    await sendTelegramToMany(rows.map(r => r.telegram_chat_id), text)
  } catch (err) {
    console.error('deptWork notifyHeads:', err)
  }
}

// Id những người đang được giao việc (lượt giao còn active). Dùng để báo cho
// người liên quan khi việc thay đổi/bị xóa.
export async function assigneeIds(taskId) {
  try {
    const { rows } = await pool.query(
      'SELECT assignee_id FROM dept_work_assignment WHERE task_id = $1 AND is_active',
      [taskId],
    )
    return rows.map(r => r.assignee_id)
  } catch { return [] }
}

// Tên người (để chèn vào thông báo). Trả '' nếu không có.
export async function userName(userId) {
  try {
    const { rows } = await pool.query('SELECT full_name FROM app_user WHERE id = $1', [userId])
    return rows[0]?.full_name || ''
  } catch { return '' }
}
