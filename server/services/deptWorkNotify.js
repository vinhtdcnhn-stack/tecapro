import { pool } from '../db.js'
import { sendTelegramMessage } from './telegram.js'
import { DEPT_KT_CO_DIEN } from '../middleware/deptWorkAccess.js'

// ──────────────────────────────────────────────────────────────────────────────
// Thông báo Telegram cho module Quản lý công việc — KT Cơ điện.
// Phần lõi (chatIdsForUsers/notifyUsers) đã chuyển sang services/notify.js dùng
// chung; file này chỉ giữ phần riêng của phòng (gửi cho trưởng/phó phòng + tra tên).
// ──────────────────────────────────────────────────────────────────────────────

export { notifyUsers } from './notify.js'

// Gửi tới toàn bộ trưởng/phó phòng KT Cơ điện (dùng cho escalation / báo vấn đề).
export async function notifyHeads(text) {
  try {
    const { rows } = await pool.query(
      `SELECT u.telegram_chat_id
         FROM dept_work_member m
         JOIN app_user u ON u.id = m.user_id
        WHERE m.department_id = $1 AND m.is_active
          AND m.dept_role IN ('HEAD','DEPUTY')
          AND u.telegram_chat_id IS NOT NULL`,
      [DEPT_KT_CO_DIEN],
    )
    for (const r of rows) if (r.telegram_chat_id) sendTelegramMessage(r.telegram_chat_id, text)
  } catch (err) {
    console.error('deptWork notifyHeads:', err)
  }
}

// Tên người (để chèn vào thông báo). Trả '' nếu không có.
export async function userName(userId) {
  try {
    const { rows } = await pool.query('SELECT full_name FROM app_user WHERE id = $1', [userId])
    return rows[0]?.full_name || ''
  } catch { return '' }
}
