import { pool } from '../db.js'
import { sendTelegramMessage } from './telegram.js'
import { DEPT_KT_CO_DIEN } from '../middleware/deptWorkAccess.js'

// ──────────────────────────────────────────────────────────────────────────────
// Thông báo Telegram cho module Quản lý công việc — KT Cơ điện.
// Tất cả fire-and-forget: gọi KHÔNG await trong controller, tự nuốt lỗi để không
// ảnh hưởng luồng nghiệp vụ. Chat id lấy từ app_user.telegram_chat_id.
// ──────────────────────────────────────────────────────────────────────────────

async function chatIdsForUsers(userIds) {
  const ids = [...new Set((userIds || []).map(Number).filter(Boolean))]
  if (!ids.length) return []
  const { rows } = await pool.query(
    'SELECT telegram_chat_id FROM app_user WHERE id = ANY($1) AND telegram_chat_id IS NOT NULL',
    [ids],
  )
  return rows.map(r => r.telegram_chat_id).filter(Boolean)
}

// Gửi tới một danh sách user (theo id). Bỏ qua người không có chat id.
export async function notifyUsers(userIds, text) {
  try {
    for (const chat of await chatIdsForUsers(userIds)) sendTelegramMessage(chat, text)
  } catch (err) {
    console.error('deptWork notifyUsers:', err)
  }
}

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
