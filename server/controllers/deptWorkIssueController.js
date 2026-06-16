import { pool } from '../db.js'
import { notifyHeads, userName } from '../services/deptWorkNotify.js'
import { notifyAction, actionText } from '../services/notify.js'

// ──────────────────────────────────────────────────────────────────────────────
// Báo cáo vấn đề khi triển khai công việc (dept_work_issue).
// Người đang được giao việc báo vấn đề; trưởng/phó phòng đánh dấu đã xử lý.
// Gác quyền ở route (isDeptMember đọc · isAssigneeOf('taskId') thêm · isHeadOrDeputy resolve).
// ──────────────────────────────────────────────────────────────────────────────

// GET /dept-work/tasks/:taskId/issues
export async function getIssues(req, res) {
  const taskId = parseInt(req.params.taskId)
  try {
    const { rows } = await pool.query(
      `SELECT i.id, i.task_id, i.assignment_id, i.content, i.status,
              i.reported_by, rp.full_name AS reported_by_name,
              i.resolved_by, rs.full_name AS resolved_by_name,
              i.resolved_at, i.created_at, i.updated_at
         FROM dept_work_issue i
         LEFT JOIN app_user rp ON rp.id = i.reported_by
         LEFT JOIN app_user rs ON rs.id = i.resolved_by
        WHERE i.task_id = $1
        ORDER BY i.status = 'open' DESC, i.created_at DESC`,
      [taskId],
    )
    res.json(rows)
  } catch (err) {
    console.error('deptWork getIssues:', err)
    res.status(500).json({ error: 'Không thể tải danh sách vấn đề.' })
  }
}

// POST /dept-work/tasks/:taskId/issues  { content }
export async function addIssue(req, res) {
  const taskId = parseInt(req.params.taskId)
  const content = req.body?.content?.trim()
  if (!content) return res.status(400).json({ error: 'Nội dung vấn đề không được để trống.' })
  try {
    // Gắn vấn đề với lượt giao active của chính người báo (nếu có) để truy vết.
    const asg = await pool.query(
      'SELECT id FROM dept_work_assignment WHERE task_id = $1 AND assignee_id = $2 AND is_active LIMIT 1',
      [taskId, req.user.id],
    )
    const { rows } = await pool.query(
      `INSERT INTO dept_work_issue (task_id, assignment_id, reported_by, content)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [taskId, asg.rows[0]?.id || null, req.user.id, content],
    )
    res.status(201).json(rows[0])

    // Báo người tạo việc + trưởng/phó phòng.
    const t = await pool.query('SELECT title, created_by FROM dept_work_task WHERE id = $1', [taskId])
    const title = t.rows[0]?.title || 'công việc'
    const actor = await userName(req.user.id)
    const msg = `${actor} báo vấn đề ở công việc:\n${title}\n${content}`
    notifyAction([t.rows[0]?.created_by], msg)
    notifyHeads(actionText(msg))
  } catch (err) {
    console.error('deptWork addIssue:', err)
    res.status(500).json({ error: 'Không thể gửi báo cáo vấn đề.' })
  }
}

// PUT /dept-work/issues/:id/resolve — trưởng/phó phòng đánh dấu đã xử lý.
export async function resolveIssue(req, res) {
  const id = parseInt(req.params.id)
  try {
    const { rowCount } = await pool.query(
      `UPDATE dept_work_issue
          SET status = 'resolved', resolved_by = $2, resolved_at = now(), updated_at = now()
        WHERE id = $1 AND status = 'open'`,
      [id, req.user.id],
    )
    if (!rowCount) return res.status(404).json({ error: 'Không tìm thấy vấn đề đang mở.' })
    res.json({ success: true })
  } catch (err) {
    console.error('deptWork resolveIssue:', err)
    res.status(500).json({ error: 'Không thể cập nhật vấn đề.' })
  }
}
