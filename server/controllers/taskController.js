import { pool } from '../db.js'
import { notifyAction, notifyInfo, contractLabel, fmtDate } from '../services/notify.js'
import { activateReadyTasks } from '../services/taskAutoStart.js'
import { cascadeCompletion, notifyCascade } from '../services/taskCascade.js'

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
    t.start_date,
    t.due_date,
    t.duration_days,
    t.status,
    t.note,
    t.completed_at,
    t.sort_order,
    t.parent_task_id,
    t.parent_start_offset,
    (SELECT COUNT(*) FROM contract_task c WHERE c.parent_task_id = t.id)::int AS child_count,
    t.created_at,
    t.updated_at,
    (SELECT COUNT(*) FROM contract_task_attachment WHERE task_id = t.id)::int AS attachment_count,
    (SELECT json_agg(json_build_object('id', a.id, 'file_name', a.file_name, 'file_path', a.file_path) ORDER BY a.created_at)
     FROM contract_task_attachment a WHERE a.task_id = t.id) AS attachments,
    COALESCE((SELECT json_agg(json_build_object(
        'id', dep.id, 'dep_type', dep.dep_type,
        'dep_task_id', dep.dep_task_id, 'dep_progress_id', dep.dep_progress_id,
        'offset_days', dep.offset_days) ORDER BY dep.id)
     FROM contract_task_dependency dep WHERE dep.task_id = t.id), '[]') AS dependencies
  FROM contract_task t
  LEFT JOIN department d  ON d.id  = t.department_id
  LEFT JOIN app_user   u  ON u.id  = t.assigned_to
  LEFT JOIN app_user   cb ON cb.id = t.created_by
`

// Ghi lại toàn bộ phụ thuộc của 1 công việc (xoá hết rồi chèn lại) trong cùng transaction.
// deps: [{ dep_type:'task'|'milestone', dep_task_id?, dep_progress_id?, offset_days? }].
// Bỏ qua bản ghi không hợp lệ và phụ thuộc vào chính nó.
async function replaceDependencies(client, taskId, deps) {
  await client.query('DELETE FROM contract_task_dependency WHERE task_id = $1', [taskId])
  if (!Array.isArray(deps) || deps.length === 0) return
  for (const d of deps) {
    const offset = parseInt(d?.offset_days, 10) || 0
    if (d?.dep_type === 'task') {
      const depTaskId = parseInt(d.dep_task_id, 10)
      if (!Number.isFinite(depTaskId) || depTaskId === taskId) continue
      await client.query(
        `INSERT INTO contract_task_dependency (task_id, dep_type, dep_task_id, offset_days)
         VALUES ($1,'task',$2,$3)`,
        [taskId, depTaskId, offset]
      )
    } else if (d?.dep_type === 'milestone') {
      const depProgressId = parseInt(d.dep_progress_id, 10)
      if (!Number.isFinite(depProgressId)) continue
      await client.query(
        `INSERT INTO contract_task_dependency (task_id, dep_type, dep_progress_id, offset_days)
         VALUES ($1,'milestone',$2,$3)`,
        [taskId, depProgressId, offset]
      )
    }
  }
}

export async function getTasks(req, res) {
  const contractId = parseInt(req.params.id)
  try {
    const { rows } = await pool.query(
      `${BASE_SELECT}
       WHERE t.contract_out_id = $1
       ORDER BY t.sort_order, t.id`,
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
    created_by, priority, start_date, due_date, duration_days, status, completed_at, note, dependencies,
    parent_task_id, parent_start_offset,
  } = req.body

  if (!title?.trim()) {
    return res.status(400).json({ error: 'Tên công việc không được để trống' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Việc con: parent phải tồn tại và thuộc đúng hợp đồng này (chống gắn chéo HĐ).
    let parentId = null
    if (parent_task_id != null) {
      const { rows: pr } = await client.query(
        'SELECT id FROM contract_task WHERE id = $1 AND contract_out_id = $2',
        [parent_task_id, contractId],
      )
      if (pr.length === 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'Công việc cha không hợp lệ.' })
      }
      parentId = pr[0].id
    }
    const { rows } = await client.query(
      `INSERT INTO contract_task
        (contract_out_id, title, description, department_id, assigned_to,
         created_by, priority, start_date, due_date, duration_days, status, completed_at, note,
         parent_task_id, parent_start_offset,
         sort_order, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
               CASE WHEN $11::varchar = 'Hoàn thành' THEN COALESCE($12::date, NOW()) ELSE NULL END,
               $13, $14, $15,
               (SELECT COALESCE(MAX(sort_order),0)+1 FROM contract_task WHERE contract_out_id = $1),
               NOW(),NOW())
       RETURNING id`,
      [
        contractId,
        title.trim(),
        description?.trim() || null,
        department_id || null,
        assigned_to   || null,
        created_by    || null,
        priority      || 'Bình thường',
        start_date    || null,
        due_date      || null,
        duration_days ?? null,
        status        || 'Chờ xử lý',
        completed_at  || null,
        note?.trim()  || null,
        parentId,
        parentId != null && parent_start_offset != null ? parseInt(parent_start_offset, 10) || 0 : null,
      ]
    )
    const id = rows[0].id
    await replaceDependencies(client, id, dependencies)
    // Thêm 1 việc con đang mở có thể khiến việc cha (đang Hoàn thành) tự mở lại.
    const cascaded = parentId ? await cascadeCompletion(client, parentId) : []
    await client.query('COMMIT')
    if (cascaded.length) notifyCascade(cascaded)
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
    await client.query('ROLLBACK').catch(() => {})
    console.error('createTask:', err)
    res.status(500).json({ error: 'Không thể tạo công việc' })
  } finally {
    client.release()
  }
}

export async function updateTask(req, res) {
  const id = parseInt(req.params.id)
  const {
    title, description, department_id, assigned_to,
    priority, start_date, due_date, duration_days, status, completed_at, note, dependencies,
    parent_start_offset,
  } = req.body

  if (!title?.trim()) {
    return res.status(400).json({ error: 'Tên công việc không được để trống' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Đọc trạng thái cũ để phát hiện đổi người phụ trách / đổi trạng thái sau khi update.
    const prev = await client.query(
      'SELECT contract_out_id, assigned_to, created_by, status FROM contract_task WHERE id = $1',
      [id],
    )
    const old = prev.rows[0]
    if (!old) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Không tìm thấy công việc' })
    }

    // Chỉ NGƯỜI TẠO việc (hoặc admin) mới được đổi người thực hiện. PM/người được giao
    // vẫn sửa được các trường khác, nhưng không đổi được assignee của việc do người khác tạo.
    const reqAssignee = Number(assigned_to) || null
    const curAssignee = Number(old.assigned_to) || null
    if (reqAssignee !== curAssignee
        && Number(req.user?.role) !== 1
        && Number(old.created_by) !== Number(req.user?.id)) {
      await client.query('ROLLBACK')
      return res.status(403).json({ error: 'Chỉ người tạo công việc (hoặc admin) mới được thay đổi người thực hiện.' })
    }

    await client.query(
      // Hoàn thành: giữ thời điểm hoàn thành cũ nếu đã có (COALESCE đọc giá trị cũ của chính dòng),
      // ngược lại lấy NOW(); trạng thái khác → NULL. Tham số hoá hoàn toàn, không nội suy chuỗi.
      // $8 phải ép ::varchar trong CASE: nếu để trần, Postgres suy ra `text` ở phép so sánh
      // literal nhưng `varchar` ở `status = $8` → lỗi 42P08 "inconsistent types deduced".
      `UPDATE contract_task SET
        title         = $1,
        description   = $2,
        department_id = $3,
        assigned_to   = $4,
        priority        = $5,
        start_date      = $6,
        due_date        = $7,
        duration_days   = $8,
        status          = $9,
        note            = $10,
        completed_at    = CASE WHEN $9::varchar = 'Hoàn thành'
                               THEN COALESCE($11::date, completed_at, NOW()) ELSE NULL END,
        -- Chỉ neo theo việc cha khi bản thân là việc con (parent_task_id không đổi ở update).
        parent_start_offset = CASE WHEN parent_task_id IS NULL THEN NULL ELSE $13::int END,
        updated_at      = NOW()
       WHERE id = $12`,
      [
        title.trim(),
        description?.trim() || null,
        department_id || null,
        assigned_to   || null,
        priority      || 'Bình thường',
        start_date    || null,
        due_date      || null,
        duration_days ?? null,
        status        || 'Chờ xử lý',
        note?.trim()  || null,
        completed_at  || null,
        id,
        parent_start_offset != null ? parseInt(parent_start_offset, 10) || 0 : null,
      ]
    )
    // Chỉ thay bộ phụ thuộc khi client gửi lên (tránh xoá nhầm khi caller không quan tâm).
    if (dependencies !== undefined) await replaceDependencies(client, id, dependencies)
    // Tự cập nhật trạng thái theo cây con: đánh giá chính việc này (nếu có con → ghi đè
    // trạng thái client gửi = khoá tay) rồi lan lên việc cha/ông.
    const cascaded = await cascadeCompletion(client, id)
    await client.query('COMMIT')
    if (cascaded.length) notifyCascade(cascaded)

    // Vừa hoàn thành 1 bước → mở khóa các việc phụ thuộc đã đủ điều kiện (chuyển sang
    // "Đang thực hiện"). Chạy TRƯỚC khi trả response để client refetch thấy ngay trạng
    // thái mới của các việc kế tiếp; thông báo bên trong vẫn fire-and-forget.
    const newStatus = status || 'Chờ xử lý'
    if (old && newStatus === 'Hoàn thành' && old.status !== 'Hoàn thành') {
      try { await activateReadyTasks() } catch (e) { console.error('activateReadyTasks:', e) }
    }

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
      const creator = Number(old.created_by) || null
      if (newStatus !== old.status && creator && creator !== actor) {
        notifyInfo([creator], `Công việc "${title.trim()}" (HĐ ${label}) đã chuyển sang trạng thái: ${newStatus}`)
      }
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('updateTask:', err)
    res.status(500).json({ error: 'Không thể cập nhật công việc' })
  } finally {
    client.release()
  }
}

export async function deleteTask(req, res) {
  const id = parseInt(req.params.id)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Nhớ việc cha trước khi xoá: xoá việc con mở cuối cùng có thể khiến cha tự Hoàn thành.
    const { rows } = await client.query('SELECT parent_task_id FROM contract_task WHERE id = $1', [id])
    const parentId = rows[0]?.parent_task_id ?? null
    await client.query('DELETE FROM contract_task WHERE id = $1', [id])
    const cascaded = parentId ? await cascadeCompletion(client, parentId) : []
    await client.query('COMMIT')
    if (cascaded.length) notifyCascade(cascaded)
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('deleteTask:', err)
    res.status(500).json({ error: 'Không thể xóa công việc' })
  } finally {
    client.release()
  }
}

// Sắp xếp lại thứ tự công việc (kéo-thả). Body: { orderedIds:[...] } — danh sách id
// (có thể là tập con khi đang lọc) theo thứ tự MỚI. Giữ nguyên các "ô" sort_order mà
// nhóm này đang chiếm rồi gán lại theo thứ tự mới → công việc ngoài tập không bị xê dịch.
export async function reorderTasks(req, res) {
  const contractId = parseInt(req.params.id)
  const ids = (Array.isArray(req.body?.orderedIds) ? req.body.orderedIds : [])
    .map(Number).filter(Number.isFinite)
  if (ids.length === 0) return res.status(400).json({ error: 'orderedIds rỗng' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Chỉ nhận việc thuộc đúng hợp đồng; khóa dòng để cập nhật nhất quán.
    const { rows } = await client.query(
      'SELECT id, sort_order FROM contract_task WHERE contract_out_id = $1 AND id = ANY($2) FOR UPDATE',
      [contractId, ids],
    )
    const valid = new Set(rows.map(r => Number(r.id)))
    const finalIds = ids.filter(id => valid.has(id))
    const slots = rows.map(r => r.sort_order).sort((a, b) => a - b)
    for (let i = 0; i < finalIds.length; i++) {
      await client.query('UPDATE contract_task SET sort_order = $1 WHERE id = $2', [slots[i], finalIds[i]])
    }
    await client.query('COMMIT')
    res.json({ success: true })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('reorderTasks:', err)
    res.status(500).json({ error: 'Không thể sắp xếp công việc' })
  } finally {
    client.release()
  }
}
