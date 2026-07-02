import { pool } from '../db.js'

// ─────────────────────────────────────────────────────────────────────────────
// Phân quyền cho module Quản lý công việc — Ban KT Cơ điện (department id 7).
// Mẫu giống contractAccess.js: admin (role=1) toàn quyền; còn lại kiểm tra DB.
//
// Phạm vi RBAC của module này CHỈ là "ai được VÀO module" (quyền module.deptwork.view, cấp
// theo vị trí/phòng ban). Bên trong: là thành viên phòng (department_id = 7) mới đọc được;
// quyền quản lý (tạo/giao/sửa/xóa) neo theo CHỨC DANH Trưởng ban / Phó ban (position id 3,4).
// Toàn bộ phần "bên trong" này HARDCODE — không qua RBAC.
// ─────────────────────────────────────────────────────────────────────────────

export const DEPT_KT_CO_DIEN = 7

// Chức danh được coi là quản lý phòng việc: Trưởng ban (3), Phó ban (4).
export const MANAGER_POSITION_IDS = [3, 4]

const ID_RE = /^\d+$/

function paramId(req, name) {
  const v = String(req.params?.[name] ?? '').trim()
  return ID_RE.test(v) ? v : null
}

const isAdmin = (req) => Number(req.user?.role) === 1

// Thành viên phòng = nhân sự thuộc Ban KT Cơ điện (app_user.department_id = 7).
async function queryIsMember(userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM app_user WHERE id = $1 AND department_id = $2 LIMIT 1`,
    [userId, DEPT_KT_CO_DIEN],
  )
  return rows.length > 0
}

// Quản lý phòng = nhân sự thuộc phòng KT Cơ điện VÀ giữ chức danh Trưởng/Phó ban.
async function queryIsHeadOrDeputy(userId) {
  const { rows } = await pool.query(
    `SELECT 1
       FROM app_user u
       JOIN app_user_position ap ON ap.user_id = u.id
      WHERE u.id = $1 AND u.department_id = $2
        AND ap.position_id = ANY($3::int[]) LIMIT 1`,
    [userId, DEPT_KT_CO_DIEN, MANAGER_POSITION_IDS],
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
