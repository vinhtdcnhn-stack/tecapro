import { pool } from '../db.js'
import { DEPT_KT_CO_DIEN } from '../middleware/deptWorkAccess.js'
import { notifyHeads, userName } from '../services/deptWorkNotify.js'
import { notifyAction, notifyInfo, actionText } from '../services/notify.js'

async function taskTitle(taskId) {
  const { rows } = await pool.query('SELECT title FROM dept_work_task WHERE id = $1', [taskId])
  return rows[0]?.title || 'công việc'
}

// ──────────────────────────────────────────────────────────────────────────────
// Chuyển việc ngang (handoff, cần người nhận chấp nhận) + đẩy việc lên cấp trên (escalation).
// Gác quyền ở route (isAssignmentHolder / isHandoffRecipient / isAssigneeOf / isHeadOrDeputy).
// ──────────────────────────────────────────────────────────────────────────────

async function isDeptMember(userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM app_user u
       LEFT JOIN dept_work_member m ON m.user_id = u.id AND m.department_id = $2 AND m.is_active
      WHERE u.id = $1 AND (u.department_id = $2 OR m.id IS NOT NULL) LIMIT 1`,
    [userId, DEPT_KT_CO_DIEN],
  )
  return rows.length > 0
}

// POST /dept-work/assignments/:id/handoff  { to_user_id, note }
// Người đang giữ việc chuyển sang người khác: tạo assignment 'pending' cho người nhận.
// Người giữ cũ VẪN active đến khi người nhận chấp nhận.
export async function handoff(req, res) {
  const assignmentId = parseInt(req.params.id)
  const toUserId = parseInt(req.body?.to_user_id)
  const note = req.body?.note?.trim() || null
  if (!toUserId) return res.status(400).json({ error: 'Vui lòng chọn người nhận.' })
  try {
    const { rows } = await pool.query(
      'SELECT task_id, assignee_id FROM dept_work_assignment WHERE id = $1', [assignmentId])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy lượt giao việc.' })
    const { task_id, assignee_id } = rows[0]
    if (toUserId === assignee_id) return res.status(400).json({ error: 'Không thể chuyển cho chính mình.' })
    if (!(await isDeptMember(toUserId))) return res.status(400).json({ error: 'Người nhận phải thuộc Ban KT Cơ điện.' })

    const ex = await pool.query(
      'SELECT 1 FROM dept_work_assignment WHERE task_id = $1 AND assignee_id = $2 AND is_active LIMIT 1',
      [task_id, toUserId])
    if (ex.rows.length) return res.status(400).json({ error: 'Người này đã là người nhận của việc.' })

    await pool.query(
      `INSERT INTO dept_work_assignment
         (task_id, assignee_id, assigned_by, is_lead, instructions, accept_state, handoff_from)
       VALUES ($1, $2, $3, false, $4, 'pending', $3)`,
      [task_id, toUserId, req.user.id, note],
    )
    res.json({ success: true })

    const actor = await userName(req.user.id)
    notifyAction([toUserId], `${actor} muốn chuyển việc cho bạn:\n${await taskTitle(task_id)}\nVui lòng chấp nhận hoặc từ chối.`)
  } catch (err) {
    console.error('deptWork handoff:', err)
    res.status(500).json({ error: 'Không thể chuyển việc.' })
  }
}

// POST /dept-work/assignments/:id/accept — người nhận chấp nhận; vô hiệu hóa người giữ cũ,
// chuyển cờ nhóm trưởng nếu người giữ cũ là nhóm trưởng.
export async function acceptHandoff(req, res) {
  const assignmentId = parseInt(req.params.id)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      'SELECT task_id, handoff_from, assigned_by FROM dept_work_assignment WHERE id = $1', [assignmentId])
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy.' }) }
    const { task_id, handoff_from, assigned_by } = rows[0]

    let inheritLead = false
    if (handoff_from) {
      const old = await client.query(
        'SELECT is_lead FROM dept_work_assignment WHERE task_id = $1 AND assignee_id = $2 AND is_active LIMIT 1',
        [task_id, handoff_from])
      inheritLead = old.rows[0]?.is_lead || false
      await client.query(
        'UPDATE dept_work_assignment SET is_active = false, updated_at = now() WHERE task_id = $1 AND assignee_id = $2 AND is_active',
        [task_id, handoff_from])
    }
    await client.query(
      `UPDATE dept_work_assignment
          SET accept_state = 'accepted', responded_at = now(), is_lead = $2, updated_at = now()
        WHERE id = $1`,
      [assignmentId, inheritLead])
    await client.query('COMMIT')
    res.json({ success: true })

    const actor = await userName(req.user.id)
    notifyInfo([handoff_from, assigned_by], `${actor} đã CHẤP NHẬN việc được chuyển:\n${await taskTitle(task_id)}`)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('deptWork acceptHandoff:', err)
    res.status(500).json({ error: 'Không thể chấp nhận việc.' })
  } finally {
    client.release()
  }
}

// POST /dept-work/assignments/:id/reject — người nhận từ chối; người giữ cũ giữ nguyên.
export async function rejectHandoff(req, res) {
  const assignmentId = parseInt(req.params.id)
  try {
    const { rows } = await pool.query(
      `UPDATE dept_work_assignment
          SET accept_state = 'rejected', is_active = false, responded_at = now(), updated_at = now()
        WHERE id = $1 RETURNING task_id, handoff_from, assigned_by`,
      [assignmentId])
    res.json({ success: true })

    if (rows.length) {
      const { task_id, handoff_from, assigned_by } = rows[0]
      const actor = await userName(req.user.id)
      notifyInfo([handoff_from, assigned_by], `${actor} đã TỪ CHỐI việc được chuyển:\n${await taskTitle(task_id)}`)
    }
  } catch (err) {
    console.error('deptWork rejectHandoff:', err)
    res.status(500).json({ error: 'Không thể từ chối việc.' })
  }
}

// POST /dept-work/tasks/:id/escalate  { note } — người nhận đẩy việc lên trưởng/phó phòng.
export async function escalate(req, res) {
  const taskId = parseInt(req.params.id)
  const note = req.body?.note?.trim() || null
  try {
    const { rowCount } = await pool.query(
      `UPDATE dept_work_task
          SET escalated = true, escalated_by = $2, escalated_at = now(), escalation_note = $3, updated_at = now()
        WHERE id = $1`,
      [taskId, req.user.id, note])
    if (!rowCount) return res.status(404).json({ error: 'Không tìm thấy công việc.' })
    res.json({ success: true })

    const actor = await userName(req.user.id)
    notifyHeads(actionText(`${actor} ĐẨY CẤP TRÊN công việc:\n${await taskTitle(taskId)}${note ? `\nLý do: ${note}` : ''}`))
  } catch (err) {
    console.error('deptWork escalate:', err)
    res.status(500).json({ error: 'Không thể đẩy việc lên cấp trên.' })
  }
}

// POST /dept-work/tasks/:id/escalate-resolve — trưởng/phó phòng gỡ cờ sau khi đã xử lý.
export async function escalateResolve(req, res) {
  const taskId = parseInt(req.params.id)
  try {
    const { rowCount } = await pool.query(
      'UPDATE dept_work_task SET escalated = false, updated_at = now() WHERE id = $1', [taskId])
    if (!rowCount) return res.status(404).json({ error: 'Không tìm thấy công việc.' })
    res.json({ success: true })
  } catch (err) {
    console.error('deptWork escalateResolve:', err)
    res.status(500).json({ error: 'Không thể gỡ cờ.' })
  }
}
