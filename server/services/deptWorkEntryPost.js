import { pool } from '../db.js'
import { notifyAction, notifyInfo } from './notify.js'
import { userName, assigneeIds, headIds } from './deptWorkNotify.js'
import { bumpLive } from './eventBus.js'
import { invalidateDashboardsForDeptWorkTask } from './cacheKeys.js'

// ─────────────────────────────────────────────────────────────────────────────
// Đăng 1 mục vào DÒNG THỜI GIAN của việc phòng (dept_work_entry) + hậu kỳ (đánh thức
// long-poll, làm mới dashboard người liên quan, báo Telegram). Song song với
// services/taskEntryPost.js bên công việc hợp đồng.
//
// Dùng cho luồng HỆ THỐNG: ghi lý do "chưa đạt" / xác nhận hoàn thành. KHÔNG kiểm tra
// quyền ở đây — nơi gọi chịu trách nhiệm gác.
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_LABEL = {
  report: 'Báo cáo', directive: 'Chỉ đạo', decision: 'Quyết định', discussion: 'Trao đổi',
}

// skipUserIds: người KHÔNG nhận thông báo chung của mục này — dùng khi nơi gọi đã gửi cho
// họ một thông điệp riêng rõ nghĩa hơn (tránh gửi trùng 2 tin cho cùng một người).
export async function postDeptWorkEntry({ taskId, type, content, authorId, skipUserIds = [] }) {
  const { rows } = await pool.query(
    `INSERT INTO dept_work_entry (task_id, entry_type, content, author_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, task_id, entry_type, content, author_id, created_at, updated_at`,
    [taskId, type, content, authorId],
  )
  const entry = rows[0]

  try {
    bumpLive('dept-work')
    invalidateDashboardsForDeptWorkTask(taskId)

    const t = await pool.query('SELECT title, created_by FROM dept_work_task WHERE id = $1', [taskId])
    const title = t.rows[0]?.title || 'công việc'
    const skip = new Set([Number(authorId), ...skipUserIds.map(Number)])
    const related = [...new Set([
      t.rows[0]?.created_by, ...await assigneeIds(taskId), ...await headIds(),
    ])].map(Number).filter(uid => uid && !skip.has(uid))
    if (related.length) {
      const actor = await userName(authorId)
      const msg = `${actor} · ${TYPE_LABEL[type] || 'Trao đổi'} ở công việc:\n${title}\n${content}`
      if (type === 'discussion') notifyInfo(related, msg)
      else notifyAction(related, msg)
    }
  } catch (e) {
    console.error('postDeptWorkEntry announce:', e)
  }
  return entry
}
