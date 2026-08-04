import { pool } from '../db.js'
import { notifyAction, notifyInfo } from '../services/notify.js'
import { userName, assigneeIds, headIds } from '../services/deptWorkNotify.js'
import { postDeptWorkEntry } from '../services/deptWorkEntryPost.js'
import { userIsHeadOrDeputy } from '../middleware/deptWorkAccess.js'
import { BASE_SELECT } from './deptWorkSelect.js'

// ─────────────────────────────────────────────────────────────────────────────
// TRẠNG THÁI + XÁC NHẬN HOÀN THÀNH của việc phòng — cùng luật với công việc hợp đồng
// (taskStatusController.js):
//   • Người ĐANG ĐƯỢC GIAO tự đổi trạng thái việc của mình. Chọn "Hoàn thành" mà không
//     có quyền xác nhận → việc gắn cờ chờ xác nhận (completion_pending).
//   • Người GIAO việc (created_by) / trưởng-phó phòng / admin bấm "Xác nhận" để chốt,
//     hoặc "Chưa đạt" KÈM LÝ DO → việc về "Đang thực hiện", lý do vào dòng thời gian.
// ─────────────────────────────────────────────────────────────────────────────

const STATUSES = new Set(['Chờ xử lý', 'Đang thực hiện', 'Hoàn thành', 'Hủy'])
const DONE = 'Hoàn thành'

// Đọc việc + vai trò của người thao tác. null nếu không tìm thấy việc.
async function roleOf(taskId, user) {
  const { rows } = await pool.query(
    `SELECT id, title, status, created_by, completion_pending, completion_requested_by,
            completion_reject_count
       FROM dept_work_task WHERE id = $1`, [taskId])
  const task = rows[0]
  if (!task) return null
  const uid = Number(user?.id)
  const isHead = await userIsHeadOrDeputy(uid, user?.role)   // đã gộp admin
  return {
    task,
    isCreator: Number(task.created_by) === uid,
    // Người giao việc kiểm soát kết quả; trưởng/phó phòng + admin dự phòng.
    canConfirm: isHead || Number(task.created_by) === uid,
  }
}

// Người THỰC HIỆN cần biết kết quả duyệt: mọi người đang được giao + người đã bấm báo hoàn
// thành (có thể đã bị chuyển việc), trừ người vừa thao tác.
async function doerIds(taskId, task, exceptUserId) {
  const ids = [...await assigneeIds(taskId), Number(task?.completion_requested_by)]
  return [...new Set(ids.map(Number))].filter(uid => uid && uid !== Number(exceptUserId))
}

async function respondTask(res, id) {
  const full = await pool.query(`${BASE_SELECT} WHERE t.id = $1`, [id])
  if (!full.rows.length) return res.status(404).json({ error: 'Không tìm thấy công việc.' })
  return res.json(full.rows[0])
}

// PUT /dept-work/tasks/:id/status  { status }
// Route gác bằng isTaskAssigneeOrLeadOrHead: nhóm trưởng, người đang được giao, trưởng/phó.
export async function updateTaskStatus(req, res) {
  const id = parseInt(req.params.id)
  const status = String(req.body?.status ?? '').trim()
  if (!STATUSES.has(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ.' })
  try {
    const rel = await roleOf(id, req.user)
    if (!rel) return res.status(404).json({ error: 'Không tìm thấy công việc.' })
    const { task, canConfirm } = rel
    if (status === 'Hủy' && !canConfirm) {
      return res.status(403).json({ error: 'Chỉ người giao việc, trưởng/phó phòng hoặc admin mới được hủy công việc.' })
    }

    const pending = status === DONE && !canConfirm
    await pool.query(
      `UPDATE dept_work_task SET
         status = $1,
         completed_at = CASE WHEN $1::varchar = 'Hoàn thành' THEN COALESCE(completed_at, now()) ELSE NULL END,
         completion_pending      = $2,
         completion_requested_by = CASE WHEN $2 THEN $3::int ELSE NULL END,
         completion_requested_at = CASE WHEN $2 THEN now() ELSE NULL END,
         completion_approved_by  = CASE WHEN $1::varchar = 'Hoàn thành' AND NOT $2 THEN $3::int ELSE NULL END,
         completion_approved_at  = CASE WHEN $1::varchar = 'Hoàn thành' AND NOT $2 THEN now() ELSE NULL END,
         updated_at = now()
       WHERE id = $4`,
      [status, pending, req.user.id, id],
    )
    await respondTask(res, id)

    if (status === task.status && !pending) return
    const actor = await userName(req.user.id)
    if (pending) {
      // Báo người giao việc + trưởng/phó phòng: cần vào xác nhận.
      const to = [...new Set([Number(task.created_by), ...await headIds()])]
        .filter(uid => uid && uid !== Number(req.user.id))
      if (to.length) {
        notifyAction(to, `${actor} báo ĐÃ HOÀN THÀNH công việc:\n${task.title}\n`
          + 'Vào Bảng công việc để XÁC NHẬN hoàn thành, hoặc trả lại kèm lý do nếu chưa đạt.')
      }
    } else {
      const to = [...new Set([...await assigneeIds(id), Number(task.created_by)])]
        .filter(uid => uid && uid !== Number(req.user.id))
      if (to.length) {
        notifyInfo(to, `${actor} đổi trạng thái công việc:\n${task.title}\n${task.status} → ${status}`)
      }
    }
  } catch (err) {
    console.error('deptWork updateTaskStatus:', err)
    if (!res.headersSent) res.status(500).json({ error: 'Không thể đổi trạng thái.' })
  }
}

// POST /dept-work/tasks/:id/completion/confirm
export async function confirmCompletion(req, res) {
  const id = parseInt(req.params.id)
  try {
    const rel = await roleOf(id, req.user)
    if (!rel) return res.status(404).json({ error: 'Không tìm thấy công việc.' })
    if (!rel.canConfirm) {
      return res.status(403).json({ error: 'Chỉ người giao việc, trưởng/phó phòng hoặc admin mới được xác nhận kết quả.' })
    }
    if (!rel.task.completion_pending) {
      return res.status(400).json({ error: 'Công việc này không ở trạng thái chờ xác nhận.' })
    }
    await pool.query(
      `UPDATE dept_work_task SET
         status = 'Hoàn thành', completed_at = COALESCE(completed_at, now()),
         completion_pending = false, completion_approved_by = $1, completion_approved_at = now(),
         updated_at = now()
       WHERE id = $2`,
      [req.user.id, id],
    )
    await respondTask(res, id)

    // Báo NGƯỜI THỰC HIỆN (những người đang được giao + người đã bấm báo hoàn thành):
    // kết quả đã được duyệt. Họ đã nhận tin riêng nên bỏ qua ở thông báo của mục dòng thời gian.
    const doers = await doerIds(id, rel.task, req.user.id)
    if (doers.length) {
      const actor = await userName(req.user.id)
      notifyInfo(doers, `✅ ${actor} đã XÁC NHẬN HOÀN THÀNH công việc của bạn:\n${rel.task.title}`)
    }

    postDeptWorkEntry({
      taskId: id, type: 'decision', authorId: req.user.id,
      content: '✅ Đã xác nhận HOÀN THÀNH công việc.',
      skipUserIds: doers,
    }).catch(e => console.error('deptWork confirm entry:', e))
  } catch (err) {
    console.error('deptWork confirmCompletion:', err)
    if (!res.headersSent) res.status(500).json({ error: 'Không thể xác nhận hoàn thành.' })
  }
}

// POST /dept-work/tasks/:id/completion/reject  { reason }
export async function rejectCompletion(req, res) {
  const id = parseInt(req.params.id)
  const reason = String(req.body?.reason ?? '').trim()
  if (!reason) return res.status(400).json({ error: 'Vui lòng nhập lý do chưa hoàn thành.' })
  try {
    const rel = await roleOf(id, req.user)
    if (!rel) return res.status(404).json({ error: 'Không tìm thấy công việc.' })
    if (!rel.canConfirm) {
      return res.status(403).json({ error: 'Chỉ người giao việc, trưởng/phó phòng hoặc admin mới được trả lại kết quả.' })
    }
    if (!rel.task.completion_pending) {
      return res.status(400).json({ error: 'Công việc này không ở trạng thái chờ xác nhận.' })
    }
    const count = Number(rel.task.completion_reject_count || 0) + 1
    await pool.query(
      `UPDATE dept_work_task SET
         status = 'Đang thực hiện', completed_at = NULL,
         completion_pending = false, completion_approved_by = NULL, completion_approved_at = NULL,
         completion_reject_reason = $1, completion_reject_count = $2,
         updated_at = now()
       WHERE id = $3`,
      [reason, count, id],
    )
    await respondTask(res, id)

    // Báo NGƯỜI THỰC HIỆN: việc bị trả lại, cần làm tiếp → notifyAction (🔔) kèm lý do.
    const doers = await doerIds(id, rel.task, req.user.id)
    if (doers.length) {
      const actor = await userName(req.user.id)
      notifyAction(doers, `❌ ${actor} đánh giá CHƯA ĐẠT công việc của bạn:\n${rel.task.title}\n`
        + `Lý do: ${reason}\nViệc đã quay lại "Đang thực hiện" — vui lòng xử lý rồi báo hoàn thành lại.`)
    }

    postDeptWorkEntry({
      taskId: id, type: 'decision', authorId: req.user.id,
      content: `❌ CHƯA ĐẠT — yêu cầu làm lại (lần ${count}).\nLý do: ${reason}`,
      skipUserIds: doers,
    }).catch(e => console.error('deptWork reject entry:', e))
  } catch (err) {
    console.error('deptWork rejectCompletion:', err)
    if (!res.headersSent) res.status(500).json({ error: 'Không thể trả lại công việc.' })
  }
}
