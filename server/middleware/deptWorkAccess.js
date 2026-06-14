import { pool } from '../db.js'

// ─────────────────────────────────────────────────────────────────────────────
// Phân quyền cho module Quản lý công việc — Ban KT Cơ điện (department id 7).
// Mẫu giống contractAccess.js: admin (role=1) toàn quyền; còn lại kiểm tra DB.
// Vai trò trong phòng lấy từ dept_work_member.dept_role ('HEAD'|'DEPUTY'|'MEMBER').
// ─────────────────────────────────────────────────────────────────────────────

export const DEPT_KT_CO_DIEN = 7

const ID_RE = /^\d+$/

function paramId(req, name) {
  const v = String(req.params?.[name] ?? '').trim()
  return ID_RE.test(v) ? v : null
}

const isAdmin = (req) => Number(req.user?.role) === 1

// Thành viên phòng: có dòng dept_work_member active HOẶC app_user.department_id = 7.
async function queryIsMember(userId) {
  const { rows } = await pool.query(
    `SELECT 1
       FROM app_user u
       LEFT JOIN dept_work_member m
         ON m.user_id = u.id AND m.department_id = $2 AND m.is_active
      WHERE u.id = $1 AND (u.department_id = $2 OR m.id IS NOT NULL)
      LIMIT 1`,
    [userId, DEPT_KT_CO_DIEN],
  )
  return rows.length > 0
}

async function queryIsHeadOrDeputy(userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM dept_work_member
      WHERE user_id = $1 AND department_id = $2 AND is_active
        AND dept_role IN ('HEAD','DEPUTY') LIMIT 1`,
    [userId, DEPT_KT_CO_DIEN],
  )
  return rows.length > 0
}

// Cho controller dùng để áp luật nghiệp vụ (vd: NV chỉ tạo việc khách hàng tự nhận).
// admin (role=1) coi như head. userRole là app_user.role (chuỗi).
export async function userIsHeadOrDeputy(userId, userRole) {
  if (Number(userRole) === 1) return true
  return queryIsHeadOrDeputy(userId)
}

const FORBIDDEN = (res, msg) => res.status(403).json({ error: msg })

// Đã đăng nhập + là thành viên phòng KT Cơ điện. Gác đọc bảng/việc + ghi nhật ký.
export async function isDeptMember(req, res, next) {
  try {
    if (isAdmin(req)) return next()
    if (await queryIsMember(req.user.id)) return next()
    FORBIDDEN(res, 'Chỉ thành viên Ban KT Cơ điện mới được truy cập mục này.')
  } catch (err) { next(err) }
}

// Trưởng/phó phòng. Gác tạo/giao/sửa/xóa việc + quản lý team/thành viên.
export async function isHeadOrDeputy(req, res, next) {
  try {
    if (isAdmin(req)) return next()
    if (await queryIsHeadOrDeputy(req.user.id)) return next()
    FORBIDDEN(res, 'Chỉ trưởng/phó phòng (hoặc admin) mới được thực hiện thao tác này.')
  } catch (err) { next(err) }
}

// Nhóm trưởng của việc HOẶC trưởng/phó phòng. Gác đổi trạng thái việc.
export function isTaskLeadOrHead(param = 'id') {
  return async (req, res, next) => {
    try {
      if (isAdmin(req)) return next()
      const taskId = paramId(req, param)
      if (!taskId) return res.status(400).json({ error: 'Tham số id không hợp lệ.' })
      if (await queryIsHeadOrDeputy(req.user.id)) return next()
      const { rows } = await pool.query(
        `SELECT 1 FROM dept_work_assignment
          WHERE task_id = $1 AND assignee_id = $2 AND is_active AND is_lead LIMIT 1`,
        [taskId, req.user.id],
      )
      if (rows.length) return next()
      FORBIDDEN(res, 'Chỉ nhóm trưởng của việc (hoặc trưởng/phó phòng) mới được đổi trạng thái.')
    } catch (err) { next(err) }
  }
}

// Người đang được giao việc (assignment active). Gác chuyển việc/đẩy cấp trên/báo vấn đề/upload.
export function isAssigneeOf(param = 'id') {
  return async (req, res, next) => {
    try {
      if (isAdmin(req)) return next()
      const taskId = paramId(req, param)
      if (!taskId) return res.status(400).json({ error: 'Tham số id không hợp lệ.' })
      const { rows } = await pool.query(
        `SELECT 1 FROM dept_work_assignment
          WHERE task_id = $1 AND assignee_id = $2 AND is_active LIMIT 1`,
        [taskId, req.user.id],
      )
      if (rows.length) return next()
      FORBIDDEN(res, 'Chỉ người đang được giao việc mới được thực hiện thao tác này.')
    } catch (err) { next(err) }
  }
}

// Trưởng/phó phòng HOẶC người đang được giao việc. Gác upload đính kèm cho việc.
export function isHeadDeputyOrAssignee(param = 'id') {
  return async (req, res, next) => {
    try {
      if (isAdmin(req)) return next()
      const taskId = paramId(req, param)
      if (!taskId) return res.status(400).json({ error: 'Tham số id không hợp lệ.' })
      if (await queryIsHeadOrDeputy(req.user.id)) return next()
      const { rows } = await pool.query(
        `SELECT 1 FROM dept_work_assignment
          WHERE task_id = $1 AND assignee_id = $2 AND is_active LIMIT 1`,
        [taskId, req.user.id],
      )
      if (rows.length) return next()
      FORBIDDEN(res, 'Chỉ trưởng/phó phòng hoặc người được giao việc mới được thực hiện thao tác này.')
    } catch (err) { next(err) }
  }
}

// Người đang giữ một assignment (active + đã nhận). Gác khởi tạo chuyển việc trên assignment đó.
export function isAssignmentHolder(param = 'id') {
  return async (req, res, next) => {
    try {
      if (isAdmin(req)) return next()
      const assignmentId = paramId(req, param)
      if (!assignmentId) return res.status(400).json({ error: 'Tham số id không hợp lệ.' })
      const { rows } = await pool.query(
        `SELECT 1 FROM dept_work_assignment
          WHERE id = $1 AND assignee_id = $2 AND is_active AND accept_state = 'accepted' LIMIT 1`,
        [assignmentId, req.user.id],
      )
      if (rows.length) return next()
      FORBIDDEN(res, 'Chỉ người đang giữ việc mới được chuyển việc.')
    } catch (err) { next(err) }
  }
}

// Người nhận của một lượt chuyển việc đang chờ (assignment.accept_state='pending'). Gác accept/reject.
export function isHandoffRecipient(param = 'id') {
  return async (req, res, next) => {
    try {
      if (isAdmin(req)) return next()
      const assignmentId = paramId(req, param)
      if (!assignmentId) return res.status(400).json({ error: 'Tham số id không hợp lệ.' })
      const { rows } = await pool.query(
        `SELECT 1 FROM dept_work_assignment
          WHERE id = $1 AND assignee_id = $2 AND accept_state = 'pending' LIMIT 1`,
        [assignmentId, req.user.id],
      )
      if (rows.length) return next()
      FORBIDDEN(res, 'Chỉ người được chuyển việc mới được chấp nhận/từ chối.')
    } catch (err) { next(err) }
  }
}

// Chủ của dòng nhật ký. Gác sửa/xóa nhật ký của chính mình.
export function isLogOwner(param = 'id') {
  return async (req, res, next) => {
    try {
      if (isAdmin(req)) return next()
      const logId = paramId(req, param)
      if (!logId) return res.status(400).json({ error: 'Tham số id không hợp lệ.' })
      const { rows } = await pool.query(
        'SELECT 1 FROM dept_work_log WHERE id = $1 AND user_id = $2 LIMIT 1',
        [logId, req.user.id],
      )
      if (rows.length) return next()
      FORBIDDEN(res, 'Bạn chỉ được sửa/xóa nhật ký của chính mình.')
    } catch (err) { next(err) }
  }
}
