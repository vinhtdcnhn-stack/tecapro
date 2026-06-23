import { pool } from '../db.js'

// ─────────────────────────────────────────────────────────────────────────────
// Phân quyền module Quản lý Đấu thầu — Ban Kế hoạch Đấu thầu (department id 9).
// Mẫu giống deptWorkAccess.js: admin (role=1) toàn quyền; còn lại kiểm tra DB.
// Vai trò trong phòng lấy từ tender_member.dept_role ('HEAD' | 'MEMBER').
//   • Trưởng phòng (HEAD): phân công người làm thầu/AM, tạo/sửa/xoá gói thầu.
//   • Nhân viên (MEMBER): lập checklist, tổng hợp, sửa gói mình phụ trách.
// ─────────────────────────────────────────────────────────────────────────────

export const DEPT_DAU_THAU = 9

const ID_RE = /^\d+$/

function paramId(req, name) {
  const v = String(req.params?.[name] ?? '').trim()
  return ID_RE.test(v) ? v : null
}

const isAdmin = (req) => Number(req.user?.role) === 1

// Thành viên phòng: có dòng tender_member active HOẶC app_user.department_id = 9.
async function queryIsMember(userId) {
  const { rows } = await pool.query(
    `SELECT 1
       FROM app_user u
       LEFT JOIN tender_member m
         ON m.user_id = u.id AND m.department_id = $2 AND m.is_active
      WHERE u.id = $1 AND (u.department_id = $2 OR m.id IS NOT NULL)
      LIMIT 1`,
    [userId, DEPT_DAU_THAU],
  )
  return rows.length > 0
}

async function queryIsHead(userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM tender_member
      WHERE user_id = $1 AND department_id = $2 AND is_active
        AND dept_role = 'HEAD' LIMIT 1`,
    [userId, DEPT_DAU_THAU],
  )
  return rows.length > 0
}

// Cho controller dùng để áp luật nghiệp vụ. admin (role=1) coi như head.
export async function userIsHead(userId, userRole) {
  if (Number(userRole) === 1) return true
  return queryIsHead(userId)
}

const FORBIDDEN = (res, msg) => res.status(403).json({ error: msg })

// Đã đăng nhập + là thành viên phòng Đấu thầu. Gác đọc danh sách/chi tiết gói.
export async function isTenderMember(req, res, next) {
  try {
    if (isAdmin(req)) return next()
    if (await queryIsMember(req.user.id)) return next()
    FORBIDDEN(res, 'Chỉ thành viên Ban Kế hoạch Đấu thầu mới được truy cập mục này.')
  } catch (err) { next(err) }
}

// Trưởng phòng. Gác phân công + quản lý thành viên + xoá gói.
export async function isHead(req, res, next) {
  try {
    if (isAdmin(req)) return next()
    if (await queryIsHead(req.user.id)) return next()
    FORBIDDEN(res, 'Chỉ Trưởng phòng (hoặc admin) mới được thực hiện thao tác này.')
  } catch (err) { next(err) }
}

// Người làm thầu của gói HOẶC Trưởng phòng. Gác sửa gói / lập checklist / tổng hợp.
export function isBidMakerOrHead(param = 'id') {
  return async (req, res, next) => {
    try {
      if (isAdmin(req)) return next()
      if (await queryIsHead(req.user.id)) return next()
      const tenderId = paramId(req, param)
      if (!tenderId) return res.status(400).json({ error: 'Tham số id không hợp lệ.' })
      const { rows } = await pool.query(
        'SELECT 1 FROM tender WHERE id = $1 AND bid_maker_id = $2 LIMIT 1',
        [tenderId, req.user.id],
      )
      if (rows.length) return next()
      FORBIDDEN(res, 'Chỉ người làm thầu của gói (hoặc Trưởng phòng) mới được thực hiện thao tác này.')
    } catch (err) { next(err) }
  }
}

// Người làm thầu của gói chứa đầu việc HOẶC Trưởng phòng. Gác tạo/sửa/xoá đầu việc.
async function bidMakerOfItem(itemId, userId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM tender_checklist_item i
       JOIN tender t ON t.id = i.tender_id
      WHERE i.id = $1 AND t.bid_maker_id = $2 LIMIT 1`,
    [itemId, userId],
  )
  return rows.length > 0
}

export function isChecklistEditor(param = 'itemId') {
  return async (req, res, next) => {
    try {
      if (isAdmin(req)) return next()
      if (await queryIsHead(req.user.id)) return next()
      const itemId = paramId(req, param)
      if (!itemId) return res.status(400).json({ error: 'Tham số id không hợp lệ.' })
      if (await bidMakerOfItem(itemId, req.user.id)) return next()
      FORBIDDEN(res, 'Chỉ người làm thầu của gói (hoặc Trưởng phòng) mới được sửa checklist.')
    } catch (err) { next(err) }
  }
}

// Người làm thầu/Trưởng phòng HOẶC người được giao đầu việc. Gác đổi trạng thái + nộp file.
async function itemContributor(itemId, userId) {
  if (await bidMakerOfItem(itemId, userId)) return true
  const { rows } = await pool.query(
    'SELECT 1 FROM tender_checklist_item WHERE id = $1 AND assignee_id = $2 LIMIT 1',
    [itemId, userId],
  )
  return rows.length > 0
}

export function isChecklistContributor(param = 'itemId') {
  return async (req, res, next) => {
    try {
      if (isAdmin(req)) return next()
      if (await queryIsHead(req.user.id)) return next()
      const itemId = paramId(req, param)
      if (!itemId) return res.status(400).json({ error: 'Tham số id không hợp lệ.' })
      if (await itemContributor(itemId, req.user.id)) return next()
      FORBIDDEN(res, 'Chỉ người được giao việc (hoặc người làm thầu/Trưởng phòng) mới được thực hiện thao tác này.')
    } catch (err) { next(err) }
  }
}

// Như isChecklistContributor nhưng param là id của TỆP đính kèm — tra ngược ra đầu việc
// rồi kiểm tra quyền. Cho người được giao xem/tải/xoá tệp sản phẩm của đúng việc họ làm,
// không cần là thành viên Ban Đấu thầu. Gác trang "Việc đấu thầu của tôi".
export function isAttachmentContributor(param = 'id') {
  return async (req, res, next) => {
    try {
      if (isAdmin(req)) return next()
      if (await queryIsHead(req.user.id)) return next()
      const attId = paramId(req, param)
      if (!attId) return res.status(400).json({ error: 'Tham số id không hợp lệ.' })
      const { rows } = await pool.query(
        'SELECT item_id FROM tender_checklist_attachment WHERE id = $1 LIMIT 1', [attId])
      if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy tệp.' })
      if (await itemContributor(rows[0].item_id, req.user.id)) return next()
      FORBIDDEN(res, 'Chỉ người được giao việc (hoặc người làm thầu/Trưởng phòng) mới được thực hiện thao tác này.')
    } catch (err) { next(err) }
  }
}
