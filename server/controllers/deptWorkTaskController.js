import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { pool } from '../db.js'
import { DEPT_KT_CO_DIEN, userIsHeadOrDeputy } from '../middleware/deptWorkAccess.js'
import { userName, assigneeIds } from '../services/deptWorkNotify.js'
import { notifyAction, notifyInfo } from '../services/notify.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TASK_UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads', 'dept-work-tasks')

// ──────────────────────────────────────────────────────────────────────────────
// CRUD việc của phòng + người nhận (n-n) + nhóm trưởng.
// Luật tạo: trưởng/phó phòng (hoặc admin) giao tự do; nhân viên thường chỉ tạo được
// việc nguồn khách hàng và TỰ NHẬN (là nhóm trưởng), không giao cho người khác.
// ──────────────────────────────────────────────────────────────────────────────

const STATUSES = new Set(['Chờ xử lý', 'Đang thực hiện', 'Hoàn thành', 'Hủy'])
const PRIORITIES = new Set(['Thấp', 'Bình thường', 'Cao', 'Khẩn'])

const BASE_SELECT = `
  SELECT
    t.id, t.department_id, t.team_id, tm.name AS team_name, tm.code AS team_code,
    t.title, t.description, t.instructions, t.priority, t.due_date, t.status,
    t.created_by, cb.full_name AS created_by_name, t.completed_at,
    t.origin, t.customer_name, t.customer_contact,
    t.escalated, t.escalated_by, eb.full_name AS escalated_by_name,
    t.escalated_at, t.escalation_note, t.created_at, t.updated_at,
    (SELECT COUNT(*) FROM dept_work_task_attachment a WHERE a.task_id = t.id)::int AS attachment_count,
    (SELECT COUNT(*) FROM dept_work_issue i WHERE i.task_id = t.id AND i.status = 'open')::int AS open_issue_count,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', asg.id, 'assignee_id', asg.assignee_id, 'assignee_name', au.full_name,
        'is_lead', asg.is_lead, 'accept_state', asg.accept_state,
        'instructions', asg.instructions, 'handoff_from', asg.handoff_from
      ) ORDER BY asg.is_lead DESC, au.full_name)
      FROM dept_work_assignment asg JOIN app_user au ON au.id = asg.assignee_id
      WHERE asg.task_id = t.id AND asg.is_active
    ), '[]') AS assignees
  FROM dept_work_task t
  LEFT JOIN dept_work_team tm ON tm.id = t.team_id
  LEFT JOIN app_user cb ON cb.id = t.created_by
  LEFT JOIN app_user eb ON eb.id = t.escalated_by
`

// Chuẩn hóa danh sách người nhận → [{user_id, is_lead, instructions}], đúng MỘT nhóm trưởng.
function normalizeAssignees(raw, fallbackLeadUserId) {
  const seen = new Set()
  const out = []
  for (const a of Array.isArray(raw) ? raw : []) {
    const uid = parseInt(a?.user_id ?? a)
    if (!uid || seen.has(uid)) continue
    seen.add(uid)
    out.push({ user_id: uid, is_lead: !!a?.is_lead, instructions: a?.instructions?.trim() || null })
  }
  if (!out.length && fallbackLeadUserId) {
    out.push({ user_id: fallbackLeadUserId, is_lead: true, instructions: null })
  }
  let leadIdx = out.findIndex(a => a.is_lead)
  if (leadIdx === -1) leadIdx = 0
  out.forEach((a, i) => { a.is_lead = i === leadIdx })
  return out
}

export async function getTasks(req, res) {
  try {
    const where = ['t.department_id = $1']
    const params = [DEPT_KT_CO_DIEN]
    const add = (cond, val) => { params.push(val); where.push(cond.replace('$$', `$${params.length}`)) }

    if (req.query.team_id)   add('t.team_id = $$', parseInt(req.query.team_id))
    if (req.query.status)    add('t.status = $$', String(req.query.status))
    if (req.query.escalated === 'true') where.push('t.escalated')
    const assignee = req.query.mine === 'true' ? req.user.id
      : (req.query.assignee_id ? parseInt(req.query.assignee_id) : null)
    if (assignee) {
      add('EXISTS (SELECT 1 FROM dept_work_assignment a WHERE a.task_id = t.id AND a.is_active AND a.assignee_id = $$)', assignee)
    }

    const { rows } = await pool.query(
      `${BASE_SELECT} WHERE ${where.join(' AND ')}
        ORDER BY t.escalated DESC, t.due_date NULLS LAST, t.id DESC`,
      params,
    )
    res.json(rows)
  } catch (err) {
    console.error('deptWork getTasks:', err)
    res.status(500).json({ error: 'Không thể tải danh sách công việc.' })
  }
}

export async function getTask(req, res) {
  try {
    const { rows } = await pool.query(`${BASE_SELECT} WHERE t.id = $1`, [parseInt(req.params.id)])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy công việc.' })
    res.json(rows[0])
  } catch (err) {
    console.error('deptWork getTask:', err)
    res.status(500).json({ error: 'Không thể tải công việc.' })
  }
}

export async function createTask(req, res) {
  const b = req.body || {}
  if (!b.title?.trim()) return res.status(400).json({ error: 'Tên công việc không được để trống.' })

  const priority = PRIORITIES.has(b.priority) ? b.priority : 'Bình thường'
  const status = STATUSES.has(b.status) ? b.status : 'Chờ xử lý'

  // Áp luật theo vai trò người tạo.
  const isHead = await userIsHeadOrDeputy(req.user.id, req.user.role)
  let origin, assignees
  if (isHead) {
    origin = b.origin === 'customer' ? 'customer' : 'internal'
    assignees = normalizeAssignees(b.assignees, null)
  } else {
    origin = 'customer'                                   // NV chỉ tạo việc khách hàng
    assignees = normalizeAssignees(null, req.user.id)     // tự nhận, là nhóm trưởng
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const ins = await client.query(
      `INSERT INTO dept_work_task
         (department_id, team_id, title, description, instructions, priority, due_date,
          status, created_by, origin, customer_name, customer_contact)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [DEPT_KT_CO_DIEN, b.team_id || null, b.title.trim(), b.description?.trim() || null,
       b.instructions?.trim() || null, priority, b.due_date || null, status, req.user.id,
       origin, b.customer_name?.trim() || null, b.customer_contact?.trim() || null],
    )
    const taskId = ins.rows[0].id
    for (const a of assignees) {
      await client.query(
        `INSERT INTO dept_work_assignment (task_id, assignee_id, assigned_by, is_lead, instructions, accept_state)
         VALUES ($1,$2,$3,$4,$5,'accepted')`,
        [taskId, a.user_id, req.user.id, a.is_lead, a.instructions],
      )
    }
    await client.query('COMMIT')
    const full = await pool.query(`${BASE_SELECT} WHERE t.id = $1`, [taskId])
    res.status(201).json(full.rows[0])

    // Báo người được giao (trừ chính người tạo nếu tự nhận).
    const recipients = assignees.map(a => a.user_id).filter(uid => uid !== req.user.id)
    if (recipients.length) {
      const actor = await userName(req.user.id)
      notifyAction(recipients, `${actor} giao cho bạn công việc mới:\n${b.title.trim()}`)
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('deptWork createTask:', err)
    res.status(500).json({ error: 'Không thể tạo công việc.' })
  } finally {
    client.release()
  }
}

export async function updateTask(req, res) {
  const id = parseInt(req.params.id)
  const b = req.body || {}
  if (!b.title?.trim()) return res.status(400).json({ error: 'Tên công việc không được để trống.' })
  const priority = PRIORITIES.has(b.priority) ? b.priority : 'Bình thường'
  const status = STATUSES.has(b.status) ? b.status : 'Chờ xử lý'
  try {
    // Lấy trạng thái + người tạo cũ để so sánh và báo người liên quan.
    const prev = await pool.query('SELECT status, created_by FROM dept_work_task WHERE id = $1', [id])
    if (!prev.rows.length) return res.status(404).json({ error: 'Không tìm thấy công việc.' })
    const { status: oldStatus, created_by: createdBy } = prev.rows[0]

    // $8::varchar trong CASE để tránh lỗi 42P08 (suy kiểu text vs varchar khi dùng lại $8).
    const { rows } = await pool.query(
      `UPDATE dept_work_task SET
         title = $1, description = $2, instructions = $3, priority = $4, due_date = $5,
         team_id = $6, origin = $7, status = $8,
         customer_name = $9, customer_contact = $10,
         completed_at = CASE WHEN $8::varchar = 'Hoàn thành' THEN COALESCE(completed_at, now()) ELSE NULL END,
         updated_at = now()
       WHERE id = $11 RETURNING id`,
      [b.title.trim(), b.description?.trim() || null, b.instructions?.trim() || null, priority,
       b.due_date || null, b.team_id || null, b.origin === 'customer' ? 'customer' : 'internal',
       status, b.customer_name?.trim() || null, b.customer_contact?.trim() || null, id],
    )
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy công việc.' })
    const full = await pool.query(`${BASE_SELECT} WHERE t.id = $1`, [id])
    res.json(full.rows[0])

    // Báo người được giao + người tạo (trừ người sửa) rằng việc đã được cập nhật.
    const recipients = [...await assigneeIds(id), createdBy].filter(uid => uid && uid !== req.user.id)
    if (recipients.length) {
      const actor = await userName(req.user.id)
      const changed = oldStatus !== status ? `\n${oldStatus} → ${status}` : ''
      notifyInfo(recipients, `${actor} đã cập nhật công việc:\n${b.title.trim()}${changed}`)
    }
  } catch (err) {
    console.error('deptWork updateTask:', err)
    res.status(500).json({ error: 'Không thể cập nhật công việc.' })
  }
}

// Đổi trạng thái — chỉ nhóm trưởng/head (gác ở route bằng isTaskLeadOrHead).
export async function updateTaskStatus(req, res) {
  const id = parseInt(req.params.id)
  const status = req.body?.status
  if (!STATUSES.has(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ.' })
  try {
    const prev = await pool.query('SELECT status, title, created_by FROM dept_work_task WHERE id = $1', [id])
    if (!prev.rows.length) return res.status(404).json({ error: 'Không tìm thấy công việc.' })
    const { status: oldStatus, title, created_by: createdBy } = prev.rows[0]

    const { rows } = await pool.query(
      `UPDATE dept_work_task SET
         status = $1,
         completed_at = CASE WHEN $1::varchar = 'Hoàn thành' THEN COALESCE(completed_at, now()) ELSE NULL END,
         updated_at = now()
       WHERE id = $2 RETURNING id`,
      [status, id],
    )
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy công việc.' })
    const full = await pool.query(`${BASE_SELECT} WHERE t.id = $1`, [id])
    res.json(full.rows[0])

    // Báo người được giao + người tạo (trừ người đổi) khi trạng thái thực sự thay đổi.
    if (oldStatus !== status) {
      const recipients = [...await assigneeIds(id), createdBy].filter(uid => uid && uid !== req.user.id)
      if (recipients.length) {
        const actor = await userName(req.user.id)
        notifyInfo(recipients, `${actor} đổi trạng thái công việc:\n${title}\n${oldStatus} → ${status}`)
      }
    }
  } catch (err) {
    console.error('deptWork updateTaskStatus:', err)
    res.status(500).json({ error: 'Không thể đổi trạng thái.' })
  }
}

export async function deleteTask(req, res) {
  const id = parseInt(req.params.id)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Lấy tiêu đề + người được giao TRƯỚC khi xóa để còn báo cho họ.
    const meta = await client.query('SELECT title FROM dept_work_task WHERE id = $1', [id])
    const recipients = (await assigneeIds(id)).filter(uid => uid && uid !== req.user.id)
    // Nhật ký trỏ tới việc (FK không cascade) → gỡ liên kết trước khi xóa việc.
    await client.query('UPDATE dept_work_log SET task_id = NULL WHERE task_id = $1', [id])
    const { rowCount } = await client.query('DELETE FROM dept_work_task WHERE id = $1', [id])
    await client.query('COMMIT')
    if (!rowCount) return res.status(404).json({ error: 'Không tìm thấy công việc.' })
    // Dọn thư mục tệp đính kèm của việc (DB cascade xóa bản ghi nhưng không xóa file trên đĩa).
    const dir = path.join(TASK_UPLOAD_ROOT, String(id))
    if (dir.startsWith(TASK_UPLOAD_ROOT + path.sep) && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    res.json({ success: true })

    // Báo người được giao (trừ người xóa) rằng việc đã bị xóa.
    if (recipients.length && meta.rows.length) {
      const actor = await userName(req.user.id)
      notifyInfo(recipients, `${actor} đã xóa công việc:\n${meta.rows[0].title}`)
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('deptWork deleteTask:', err)
    res.status(500).json({ error: 'Không thể xóa công việc.' })
  } finally {
    client.release()
  }
}
