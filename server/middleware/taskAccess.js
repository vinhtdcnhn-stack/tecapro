import { pool } from '../db.js'
import { isPmOfContract } from './contractAccess.js'

// ─────────────────────────────────────────────────────────────────────────────
// Quyền TRẠNG THÁI của công việc hợp đồng (contract_task) — tách riêng khỏi
// contractAccess.js (đã dài) vì đây là luồng nghiệp vụ độc lập:
//
//   • ĐỔI trạng thái  : admin, PM của HĐ, người TẠO việc, người ĐƯỢC GIAO (kể cả việc
//                       gốc), hoặc người được giao VIỆC CHA.
//   • XÁC NHẬN hoàn thành / trả lại: admin, PM của HĐ, người TẠO việc (người giao việc).
//
// Người được giao tự bấm "Hoàn thành" → việc vào trạng thái CHỜ XÁC NHẬN
// (completion_pending = true); người xác nhận duyệt thì mới chốt, không duyệt thì trả về
// "Đang thực hiện" kèm lý do. Xem taskStatusController.js.
// ─────────────────────────────────────────────────────────────────────────────

const ID_RE = /^\d+$/

// Đọc việc + tính vai trò của user với việc đó. Trả null nếu không tìm thấy việc.
export async function taskRolesOf(taskId, user) {
  const { rows } = await pool.query(
    `SELECT t.id, t.contract_out_id, t.title, t.assigned_to, t.created_by, t.status,
            t.parent_task_id, t.completion_pending, t.completion_reject_count,
            p.assigned_to AS parent_assigned_to,
            (SELECT COUNT(*) FROM contract_task c WHERE c.parent_task_id = t.id)::int AS child_count
       FROM contract_task t
       LEFT JOIN contract_task p ON p.id = t.parent_task_id
      WHERE t.id = $1`,
    [taskId],
  )
  const task = rows[0]
  if (!task) return null

  const uid = Number(user?.id)
  const isAdmin = Number(user?.role) === 1
  const isPm = isAdmin || await isPmOfContract(uid, String(task.contract_out_id))
  const isCreator = Number(task.created_by) === uid
  const isAssignee = Number(task.assigned_to) === uid
  const isParentAssignee = Number(task.parent_assigned_to) === uid

  return {
    task, isAdmin, isPm, isCreator, isAssignee, isParentAssignee,
    canChange: isPm || isCreator || isAssignee || isParentAssignee,
    // Người giao việc kiểm soát kết quả; PM/admin dự phòng khi người giao vắng.
    canConfirm: isPm || isCreator,
  }
}

// Guard cho các route trạng thái: gắn sẵn req.taskRoles để controller khỏi truy vấn lại.
export function canChangeTaskStatus(param = 'id') {
  return async function guard(req, res, next) {
    try {
      const taskId = String(req.params[param] ?? '')
      if (!ID_RE.test(taskId)) {
        res.status(400).json({ error: 'Tham số id không hợp lệ.' })
        return
      }
      const roles = await taskRolesOf(taskId, req.user)
      if (!roles) { res.status(404).json({ error: 'Không tìm thấy công việc.' }); return }
      if (!roles.canChange) {
        res.status(403).json({
          error: 'Chỉ PM/admin, người giao việc hoặc người được giao mới được đổi trạng thái công việc này.',
        })
        return
      }
      req.taskRoles = roles
      next()
    } catch (err) { next(err) }
  }
}

// Guard cho xác nhận / trả lại kết quả: chỉ người giao việc, PM của HĐ, admin.
export function canConfirmTaskCompletion(param = 'id') {
  return async function guard(req, res, next) {
    try {
      const taskId = String(req.params[param] ?? '')
      if (!ID_RE.test(taskId)) {
        res.status(400).json({ error: 'Tham số id không hợp lệ.' })
        return
      }
      const roles = await taskRolesOf(taskId, req.user)
      if (!roles) { res.status(404).json({ error: 'Không tìm thấy công việc.' }); return }
      if (!roles.canConfirm) {
        res.status(403).json({
          error: 'Chỉ người giao việc, PM của hợp đồng hoặc admin mới được xác nhận kết quả công việc.',
        })
        return
      }
      req.taskRoles = roles
      next()
    } catch (err) { next(err) }
  }
}
