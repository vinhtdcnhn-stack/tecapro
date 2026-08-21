import { pool } from '../db.js'
import { notifyAction, notifyInfo, contractLabel, fmtDate } from '../services/notify.js'
import { activateReadyTasks } from '../services/taskAutoStart.js'
import { cascadeCompletion, notifyCascade } from '../services/taskCascade.js'
import { BASE_SELECT } from './taskSelect.js'
import { taskRolesOf } from '../middleware/taskAccess.js'
import { autoAddTechnicalMember } from '../services/autoTechnicalMember.js'
import { MEMBER_ROLE_VN } from './contractMemberController.js'
import { invalidateContract, invalidateContractList, invalidateUserDashboards } from '../services/cacheKeys.js'

// Ghi 1 dòng nhật ký giao/chuyển việc. Gọi trong cùng transaction (client) khi tạo việc
// có người thực hiện hoặc khi đổi người thực hiện. action: 'assign' (giao lần đầu) |
// 'transfer' (chuyển việc). Bỏ qua khi không có người nhận (to_user_id NULL vô nghĩa).
async function logAssignment(client, { taskId, fromUserId, toUserId, action, actorId, note }) {
  if (!toUserId) return
  await client.query(
    `INSERT INTO contract_task_assignment_log
       (task_id, from_user_id, to_user_id, action, actor_id, note)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [taskId, fromUserId || null, toUserId, action, actorId || null, note?.trim() || null],
  )
}

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
    // Số mục dòng thời gian CHƯA ĐỌC của user hiện tại cho mỗi việc (để dòng việc hiện chấm).
    const uid = req.user?.id
    if (uid) {
      const { rows: ur } = await pool.query(
        `SELECT e.task_id, COUNT(*)::int AS unread
           FROM contract_task_entry e
           JOIN contract_task t ON t.id = e.task_id
           LEFT JOIN contract_task_read r ON r.task_id = e.task_id AND r.user_id = $2
          WHERE t.contract_out_id = $1
            AND e.author_id <> $2
            AND e.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)
          GROUP BY e.task_id`,
        [contractId, uid],
      )
      const unreadByTask = new Map(ur.map(r => [String(r.task_id), r.unread]))
      for (const row of rows) row.unread_count = unreadByTask.get(String(row.id)) || 0
    }
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
    // Ghi nhật ký "giao lần đầu" nếu việc được tạo đã có người thực hiện.
    if (assigned_to) {
      await logAssignment(client, {
        taskId: id, fromUserId: null, toUserId: Number(assigned_to),
        action: 'assign', actorId: created_by || req.user?.id,
      })
    }
    // Thêm 1 việc con đang mở có thể khiến việc cha (đang Hoàn thành) tự mở lại.
    const cascaded = parentId ? await cascadeCompletion(client, parentId) : []
    await client.query('COMMIT')
    if (cascaded.length) notifyCascade(cascaded)
    // Việc tạo ra mà ĐÃ tới ngày bắt đầu (ngày cố định/bước trước/việc cha) → tự chuyển
    // sang "Đang thực hiện" ngay. Bỏ qua thông báo auto-start cho chính việc này vì bên
    // dưới đã có thông báo "được giao việc mới".
    try { await activateReadyTasks([id]) } catch (e) { console.error('activateReadyTasks(create):', e) }
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
    parent_start_offset, assignment_note,
  } = req.body

  if (!title?.trim()) {
    return res.status(400).json({ error: 'Tên công việc không được để trống' })
  }

  // Đặt "Hoàn thành" ngay trong form sửa: nếu người sửa KHÔNG có quyền xác nhận kết quả
  // (vd người được giao việc con) thì việc chỉ vào diện CHỜ XÁC NHẬN — cùng luật với
  // taskStatusController, để không có đường vòng qua màn hình sửa.
  const roles = await taskRolesOf(id, req.user)
  const pendingApproval = (status || 'Chờ xử lý') === 'Hoàn thành' && !!roles && !roles.canConfirm

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
        -- Cờ chờ xác nhận: bật khi người sửa không có quyền chốt; tắt ở mọi trạng thái khác.
        completion_pending      = $14,
        completion_requested_by = CASE WHEN $14 THEN $15::int ELSE NULL END,
        completion_requested_at = CASE WHEN $14 THEN NOW() ELSE NULL END,
        completion_approved_by  = CASE WHEN $9::varchar = 'Hoàn thành' AND NOT $14 THEN $15::int ELSE NULL END,
        completion_approved_at  = CASE WHEN $9::varchar = 'Hoàn thành' AND NOT $14 THEN NOW() ELSE NULL END,
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
        pendingApproval,
        req.user?.id || null,
      ]
    )
    // Đổi người thực hiện qua màn sửa → ghi nhật ký chuyển việc (kèm lý do nếu có).
    if (reqAssignee !== curAssignee) {
      await logAssignment(client, {
        taskId: id, fromUserId: curAssignee, toUserId: reqAssignee,
        action: curAssignee ? 'transfer' : 'assign', actorId: req.user?.id,
        note: assignment_note,
      })
    }
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

      // Đổi trạng thái → báo người tạo việc. Nếu đang CHỜ XÁC NHẬN thì đây là việc cần họ
      // xử lý (bấm xác nhận / trả lại) → notifyAction; ngược lại chỉ là tin nắm.
      const creator = Number(old.created_by) || null
      if (newStatus !== old.status && creator && creator !== actor) {
        if (pendingApproval) {
          notifyAction([creator], `Công việc "${title.trim()}" (HĐ ${label}) đã được báo HOÀN THÀNH — cần bạn xác nhận.`)
        } else {
          notifyInfo([creator], `Công việc "${title.trim()}" (HĐ ${label}) đã chuyển sang trạng thái: ${newStatus}`)
        }
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

// PUT /tasks/:id/transfer — Chuyển việc: chỉ đổi NGƯỜI THỰC HIỆN của chính việc này
// (không tạo việc con). Quyền: PM/admin, người tạo việc, HOẶC người đang được giao
// (đã kiểm ở middleware canTransferTask). Body: { assigned_to, department_id?, note? }.
export async function transferTask(req, res) {
  const id = parseInt(req.params.id)
  const { assigned_to, department_id, note } = req.body
  const toUser = Number(assigned_to) || null
  if (!toUser) return res.status(400).json({ error: 'Vui lòng chọn người để chuyển việc.' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const prev = await client.query(
      'SELECT contract_out_id, assigned_to, title FROM contract_task WHERE id = $1',
      [id],
    )
    const old = prev.rows[0]
    if (!old) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Không tìm thấy công việc' })
    }
    const fromUser = Number(old.assigned_to) || null
    if (toUser === fromUser) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Người được chọn đã là người thực hiện hiện tại.' })
    }

    await client.query(
      `UPDATE contract_task
          SET assigned_to   = $1,
              department_id = COALESCE($2, department_id),
              updated_at    = NOW()
        WHERE id = $3`,
      [toUser, department_id || null, id],
    )
    await logAssignment(client, {
      taskId: id, fromUserId: fromUser, toUserId: toUser,
      action: fromUser ? 'transfer' : 'assign', actorId: req.user?.id, note,
    })

    // Trưởng/Phó ban Dự án & CGCN / Kỹ thuật chuyển việc cho người của 2 ban đó →
    // tự bổ sung họ vào danh sách Kỹ thuật của HĐ nếu chưa có (xem autoTechnicalMember.js).
    const addedTech = await autoAddTechnicalMember(client, {
      contractId: old.contract_out_id, actorId: req.user?.id, toUserId: toUser,
    })
    await client.query('COMMIT')

    // Danh sách thành viên đổi → tab Thông tin HĐ, danh sách HĐ (theo quyền) và
    // dashboard của người vừa được thêm đều cần làm mới.
    if (addedTech) {
      invalidateContract(old.contract_out_id, 'info')
      invalidateContractList()
      invalidateUserDashboards(toUser)
    }

    // Việc vừa chuyển có thể đã tới ngày bắt đầu → tự kích hoạt; bỏ qua nếu lỗi.
    try { await activateReadyTasks([id]) } catch (e) { console.error('activateReadyTasks(transfer):', e) }

    const full = await pool.query(`${BASE_SELECT} WHERE t.id = $1`, [id])
    res.json({ ...full.rows[0], added_to_technical: addedTech })

    // Báo người được giao mới (việc cần xử lý 🔔). Không tự báo khi tự nhận.
    if (toUser !== req.user?.id) {
      const label = await contractLabel(old.contract_out_id)
      notifyAction([toUser], `Bạn được chuyển công việc: "${old.title}" — HĐ ${label}`)
      if (addedTech) {
        notifyInfo([toUser], `Bạn được thêm vào hợp đồng ${label} với vai trò: ${MEMBER_ROLE_VN.Technical}`)
      }
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('transferTask:', err)
    res.status(500).json({ error: 'Không thể chuyển việc' })
  } finally {
    client.release()
  }
}

// GET /tasks/:id/assignment-log — nhật ký giao/chuyển việc (mới nhất sau cùng), kèm tên
// người. Dùng cho hint khi di chuột vào tên người thực hiện.
export async function getAssignmentLog(req, res) {
  const id = parseInt(req.params.id)
  try {
    const { rows } = await pool.query(
      `SELECT l.id, l.action, l.created_at, l.note,
              l.from_user_id, fu.full_name AS from_name,
              l.to_user_id,   tu.full_name AS to_name,
              l.actor_id,     au.full_name AS actor_name
         FROM contract_task_assignment_log l
         LEFT JOIN app_user fu ON fu.id = l.from_user_id
         LEFT JOIN app_user tu ON tu.id = l.to_user_id
         LEFT JOIN app_user au ON au.id = l.actor_id
        WHERE l.task_id = $1
        ORDER BY l.created_at, l.id`,
      [id],
    )
    res.json(rows)
  } catch (err) {
    console.error('getAssignmentLog:', err)
    res.status(500).json({ error: 'Không thể tải nhật ký giao việc' })
  }
}
