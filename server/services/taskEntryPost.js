import { pool } from '../db.js'
import { notifyAction, notifyInfo, contractLabel, pmUserIds } from './notify.js'
import { bumpLive } from './eventBus.js'
import { invalidateDashboardsForContractTask } from './cacheKeys.js'

// ─────────────────────────────────────────────────────────────────────────────
// Đăng 1 mục vào DÒNG THỜI GIAN của công việc hợp đồng + các việc kèm theo (đánh dấu tác
// giả đã đọc, đánh thức long-poll, làm mới dashboard người liên quan, báo Telegram).
//
// Dùng chung cho:
//   • taskEntryController.addEntry — người dùng tự gõ (đã kiểm tra quyền đăng trước đó);
//   • taskStatusController        — hệ thống ghi lý do "chưa đạt" / xác nhận hoàn thành.
// KHÔNG kiểm tra quyền ở đây: nơi gọi chịu trách nhiệm gác.
// ─────────────────────────────────────────────────────────────────────────────

export const TYPE_LABEL = {
  report: 'Báo cáo', directive: 'Chỉ đạo', decision: 'Quyết định', discussion: 'Trao đổi',
}

// Ghi mốc đã đọc cho 1 người ở 1 việc (để tắt chấm chưa đọc).
export async function markTaskRead(taskId, userId) {
  await pool.query(
    `INSERT INTO contract_task_read (task_id, user_id, last_read_at)
     VALUES ($1, $2, now())
     ON CONFLICT (task_id, user_id) DO UPDATE SET last_read_at = now()`,
    [taskId, userId],
  )
}

// Chèn mục + trả về bản ghi đã kèm tên tác giả (chưa gồm ảnh).
export async function insertTaskEntry({ taskId, type, content, authorId }) {
  const { rows } = await pool.query(
    `INSERT INTO contract_task_entry (task_id, entry_type, content, author_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, task_id, entry_type, content, author_id, created_at, updated_at`,
    [taskId, type, content, authorId],
  )
  const entry = rows[0]
  const me = await pool.query('SELECT full_name FROM app_user WHERE id = $1', [authorId])
  entry.author_name = me.rows[0]?.full_name || null
  entry.images = []
  return entry
}

// Việc "hậu kỳ" sau khi đã trả response: đánh thức long-poll, làm mới dashboard, báo người
// liên quan (người tạo + người được giao + PM của HĐ, trừ tác giả). Tự nuốt lỗi.
//
// skipUserIds: người KHÔNG nhận thông báo chung của mục này — dùng khi nơi gọi đã gửi cho
// họ một thông điệp riêng, rõ nghĩa hơn (vd xác nhận/trả lại kết quả gửi thẳng cho người
// thực hiện), tránh gửi trùng 2 tin cho cùng một người.
export async function announceTaskEntry({
  taskId, type, content, authorId, authorName, contractId, createdBy, assignedTo, skipUserIds = [],
}) {
  try {
    bumpLive('contract-task')
    invalidateDashboardsForContractTask(taskId)
    markTaskRead(taskId, authorId).catch(e => console.error('contractTask markRead:', e))

    const t = await pool.query('SELECT title FROM contract_task WHERE id = $1', [taskId])
    const title = t.rows[0]?.title || 'công việc'
    const skip = new Set([Number(authorId), ...skipUserIds.map(Number)])
    const related = [...new Set([
      createdBy, assignedTo, ...await pmUserIds(String(contractId)),
    ])].map(Number).filter(uid => uid && !skip.has(uid))
    if (!related.length) return
    const label = await contractLabel(contractId)
    const msg = `${authorName || 'Ai đó'} · ${TYPE_LABEL[type] || 'Trao đổi'} ở công việc:\n${title} (HĐ ${label})\n${content}`
    // Báo cáo/chỉ đạo/quyết định cần nắm & xử lý → notifyAction; trao đổi → notifyInfo.
    if (type === 'discussion') notifyInfo(related, msg)
    else notifyAction(related, msg)
  } catch (e) {
    console.error('announceTaskEntry:', e)
  }
}

// Tiện ích 1 bước cho luồng hệ thống (xác nhận / trả lại kết quả): chèn mục rồi loan báo.
export async function postTaskEntry({
  taskId, type, content, authorId, contractId, createdBy, assignedTo, skipUserIds = [],
}) {
  const entry = await insertTaskEntry({ taskId, type, content, authorId })
  announceTaskEntry({
    taskId, type, content, authorId, authorName: entry.author_name,
    contractId, createdBy, assignedTo, skipUserIds,
  })
  return entry
}
