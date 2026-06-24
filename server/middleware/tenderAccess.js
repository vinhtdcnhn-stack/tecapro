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

// Người làm thầu của gói chứa đầu việc (export cho controller áp luật mở khoá trạng thái).
export async function userIsBidMakerOfItem(itemId, userId) {
  return bidMakerOfItem(itemId, userId)
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

// GHI tệp sản phẩm của đầu việc (tạo thư mục / upload). Như isChecklistContributor
// nhưng ĐÓNG BĂNG khi đầu việc đã 'Hoàn thành': lúc đó không ai được thay đổi tệp
// (kể cả người làm thầu/Trưởng phòng) — phải mở lại trạng thái trước. admin ngoại lệ.
export function isItemDocEditor(param = 'itemId') {
  return async (req, res, next) => {
    try {
      if (isAdmin(req)) return next()
      const itemId = paramId(req, param)
      if (!itemId) return res.status(400).json({ error: 'Tham số id không hợp lệ.' })
      const { rows } = await pool.query(
        'SELECT status FROM tender_checklist_item WHERE id = $1', [itemId])
      if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy đầu việc.' })
      if (rows[0].status === 'Hoàn thành') {
        return FORBIDDEN(res, 'Đầu việc đã hoàn thành — cần mở lại trạng thái trước khi thay đổi tệp sản phẩm.')
      }
      if (await queryIsHead(req.user.id)) return next()
      if (await itemContributor(itemId, req.user.id)) return next()
      FORBIDDEN(res, 'Chỉ người được giao việc (hoặc người làm thầu/Trưởng phòng) mới được thực hiện thao tác này.')
    } catch (err) { next(err) }
  }
}

// ── Curate review theo từng đầu việc ─────────────────────────────────────────
// Quyền CURATE (đánh dấu loại file/thư mục, tải file thay thế, gửi review) thuộc về
// NGƯỜI PHỤ TRÁCH GÓI (bid_maker) — hoặc Trưởng phòng / admin. Chỉ cho curate khi đầu
// việc CHƯA đang chờ duyệt và CHƯA được duyệt (review_status ∉ {pending, approved}).
// Param có thể là itemId, hoặc id của file/thư mục → tra ngược ra đầu việc.
async function itemIdFrom(kind, rawId) {
  if (kind === 'item') return /^\d+$/.test(String(rawId)) ? rawId : null
  const table = kind === 'file' ? 'document_file' : 'document_folder'
  const { rows } = await pool.query(`SELECT item_id FROM ${table} WHERE id = $1 LIMIT 1`, [rawId])
  return rows[0]?.item_id ?? null
}

export function isItemReviewCurator(kind = 'item', param = 'itemId') {
  return async (req, res, next) => {
    try {
      const rawId = paramId(req, param)
      if (!rawId) return res.status(400).json({ error: 'Tham số id không hợp lệ.' })
      const itemId = await itemIdFrom(kind, rawId)
      if (!itemId) return res.status(404).json({ error: 'Không tìm thấy đầu việc.' })

      const { rows } = await pool.query(
        `SELECT i.review_status, t.bid_maker_id
           FROM tender_checklist_item i JOIN tender t ON t.id = i.tender_id
          WHERE i.id = $1`, [itemId])
      if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy đầu việc.' })
      const { review_status, bid_maker_id } = rows[0]

      if (!isAdmin(req)) {
        const allowed = await queryIsHead(req.user.id) || Number(bid_maker_id) === Number(req.user.id)
        if (!allowed) {
          return FORBIDDEN(res, 'Chỉ người phụ trách gói (hoặc Trưởng phòng) mới được curate/gửi review.')
        }
      }
      // admin cũng phải tôn trọng khoá phase: đã gửi/đã duyệt thì không curate được nữa.
      if (review_status === 'pending' || review_status === 'approved') {
        return FORBIDDEN(res, review_status === 'pending'
          ? 'Đầu việc đang chờ duyệt — không thể chỉnh sửa bản gửi review.'
          : 'Đầu việc đã được duyệt — không thể chỉnh sửa bản gửi review.')
      }
      req.reviewItemId = String(itemId)
      next()
    } catch (err) { next(err) }
  }
}

// ── Lô + nhà thầu dự thầu ────────────────────────────────────────────────────
// Sửa lô/nhà thầu = người làm thầu của gói HOẶC Trưởng phòng/admin (như sửa gói).
// isLotEditor: param là id của lô → tra ngược tender.bid_maker_id.
export function isLotEditor(param = 'lotId') {
  return async (req, res, next) => {
    try {
      if (isAdmin(req)) return next()
      if (await queryIsHead(req.user.id)) return next()
      const lotId = paramId(req, param)
      if (!lotId) return res.status(400).json({ error: 'Tham số id không hợp lệ.' })
      const { rows } = await pool.query(
        `SELECT 1 FROM tender_lot l JOIN tender t ON t.id = l.tender_id
          WHERE l.id = $1 AND t.bid_maker_id = $2 LIMIT 1`,
        [lotId, req.user.id],
      )
      if (rows.length) return next()
      FORBIDDEN(res, 'Chỉ người làm thầu của gói (hoặc Trưởng phòng) mới được sửa lô/nhà thầu.')
    } catch (err) { next(err) }
  }
}

// isBidderEditor: param là id của nhà thầu → tra ngược qua lô về tender.bid_maker_id.
export function isBidderEditor(param = 'bidderId') {
  return async (req, res, next) => {
    try {
      if (isAdmin(req)) return next()
      if (await queryIsHead(req.user.id)) return next()
      const bidderId = paramId(req, param)
      if (!bidderId) return res.status(400).json({ error: 'Tham số id không hợp lệ.' })
      const { rows } = await pool.query(
        `SELECT 1 FROM tender_bidder b
           JOIN tender_lot l ON l.id = b.lot_id
           JOIN tender t ON t.id = l.tender_id
          WHERE b.id = $1 AND t.bid_maker_id = $2 LIMIT 1`,
        [bidderId, req.user.id],
      )
      if (rows.length) return next()
      FORBIDDEN(res, 'Chỉ người làm thầu của gói (hoặc Trưởng phòng) mới được sửa nhà thầu.')
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
