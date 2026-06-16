import { pool } from '../db.js'
import { notifyAction, notifyInfo, contractLabel, fmtDate } from '../services/notify.js'

const BASE_SELECT = `
  SELECT
    t.id,
    t.contract_out_id,
    t.title,
    t.description,
    t.department_id,
    d.name  AS department_name,
    t.assigned_to,
    u.full_name AS assigned_to_name,
    t.created_by,
    cb.full_name AS created_by_name,
    t.priority,
    t.due_date,
    t.status,
    t.note,
    t.completed_at,
    t.created_at,
    t.updated_at,
    (SELECT COUNT(*) FROM contract_task_attachment WHERE task_id = t.id)::int AS attachment_count,
    (SELECT json_agg(json_build_object('id', a.id, 'file_name', a.file_name, 'file_path', a.file_path) ORDER BY a.created_at)
     FROM contract_task_attachment a WHERE a.task_id = t.id) AS attachments
  FROM contract_task t
  LEFT JOIN department d  ON d.id  = t.department_id
  LEFT JOIN app_user   u  ON u.id  = t.assigned_to
  LEFT JOIN app_user   cb ON cb.id = t.created_by
`

export async function getTasks(req, res) {
  const contractId = parseInt(req.params.id)
  try {
    const { rows } = await pool.query(
      `${BASE_SELECT}
       WHERE t.contract_out_id = $1
       ORDER BY t.department_id NULLS LAST, t.due_date NULLS LAST, t.id`,
      [contractId]
    )
    res.json(rows)
  } catch (err) {
    console.error('getTasks:', err)
    res.status(500).json({ error: 'Không thể tải danh sách công việc' })
  }
}

export async function createTask(req, res) {
  const contractId = parseInt(req.params.id)
  const {
    title, description, department_id, assigned_to,
    created_by, priority, due_date, status, note
  } = req.body

  if (!title?.trim()) {
    return res.status(400).json({ error: 'Tên công việc không được để trống' })
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO contract_task
        (contract_out_id, title, description, department_id, assigned_to,
         created_by, priority, due_date, status, note, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
       RETURNING id`,
      [
        contractId,
        title.trim(),
        description?.trim() || null,
        department_id || null,
        assigned_to   || null,
        created_by    || null,
        priority      || 'Bình thường',
        due_date      || null,
        status        || 'Chờ xử lý',
        note?.trim()  || null,
      ]
    )
    const id = rows[0].id
    const full = await pool.query(`${BASE_SELECT} WHERE t.id = $1`, [id])
    res.json(full.rows[0])

    // Báo người được giao việc (việc cần xử lý → 🔔 in đậm). Không tự báo cho chính mình.
    const assignee = Number(assigned_to) || null
    if (assignee && assignee !== req.user?.id) {
      const label = await contractLabel(contractId)
      const han = due_date ? `\nHạn: ${fmtDate(due_date)}` : ''
      notifyAction([assignee], `Bạn được giao công việc mới: "${title.trim()}" — HĐ ${label}${han}`)
    }
  } catch (err) {
    console.error('createTask:', err)
    res.status(500).json({ error: 'Không thể tạo công việc' })
  }
}

export async function updateTask(req, res) {
  const id = parseInt(req.params.id)
  const {
    title, description, department_id, assigned_to,
    priority, due_date, status, note
  } = req.body

  if (!title?.trim()) {
    return res.status(400).json({ error: 'Tên công việc không được để trống' })
  }

  try {
    // Đọc trạng thái cũ để phát hiện đổi người phụ trách / đổi trạng thái sau khi update.
    const prev = await pool.query(
      'SELECT contract_out_id, assigned_to, created_by, status FROM contract_task WHERE id = $1',
      [id],
    )
    const old = prev.rows[0]

    await pool.query(
      // Hoàn thành: giữ thời điểm hoàn thành cũ nếu đã có (COALESCE đọc giá trị cũ của chính dòng),
      // ngược lại lấy NOW(); trạng thái khác → NULL. Tham số hoá hoàn toàn, không nội suy chuỗi.
      // $7 phải ép ::varchar trong CASE: nếu để trần, Postgres suy ra `text` ở phép so sánh
      // literal nhưng `varchar` ở `status = $7` → lỗi 42P08 "inconsistent types deduced".
      `UPDATE contract_task SET
        title         = $1,
        description   = $2,
        department_id = $3,
        assigned_to   = $4,
        priority      = $5,
        due_date      = $6,
        status        = $7,
        note          = $8,
        completed_at  = CASE WHEN $7::varchar = 'Hoàn thành' THEN COALESCE(completed_at, NOW()) ELSE NULL END,
        updated_at    = NOW()
       WHERE id = $9`,
      [
        title.trim(),
        description?.trim() || null,
        department_id || null,
        assigned_to   || null,
        priority      || 'Bình thường',
        due_date      || null,
        status        || 'Chờ xử lý',
        note?.trim()  || null,
        id,
      ]
    )
    const full = await pool.query(`${BASE_SELECT} WHERE t.id = $1`, [id])
    if (full.rows.length === 0) return res.status(404).json({ error: 'Không tìm thấy công việc' })
    res.json(full.rows[0])

    // Thông báo các thay đổi liên quan tới người dùng (sau khi đã trả response).
    if (old) {
      const actor = req.user?.id
      const newAssignee = Number(assigned_to) || null
      const oldAssignee = Number(old.assigned_to) || null
      const label = await contractLabel(old.contract_out_id)

      // Đổi người phụ trách → báo người mới (việc cần xử lý 🔔). Không báo nếu tự nhận.
      if (newAssignee && newAssignee !== oldAssignee && newAssignee !== actor) {
        const han = due_date ? `\nHạn: ${fmtDate(due_date)}` : ''
        notifyAction([newAssignee], `Bạn được giao công việc: "${title.trim()}" — HĐ ${label}${han}`)
      }

      // Đổi trạng thái → báo người tạo việc (thông tin). Không báo nếu chính họ đổi.
      const newStatus = status || 'Chờ xử lý'
      const creator = Number(old.created_by) || null
      if (newStatus !== old.status && creator && creator !== actor) {
        notifyInfo([creator], `Công việc "${title.trim()}" (HĐ ${label}) đã chuyển sang trạng thái: ${newStatus}`)
      }
    }
  } catch (err) {
    console.error('updateTask:', err)
    res.status(500).json({ error: 'Không thể cập nhật công việc' })
  }
}

export async function deleteTask(req, res) {
  const id = parseInt(req.params.id)
  try {
    await pool.query('DELETE FROM contract_task WHERE id = $1', [id])
    res.json({ success: true })
  } catch (err) {
    console.error('deleteTask:', err)
    res.status(500).json({ error: 'Không thể xóa công việc' })
  }
}
