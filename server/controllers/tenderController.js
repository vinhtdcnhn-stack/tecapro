import { pool } from '../db.js'
import { notifyAction } from '../services/notify.js'
import { userIsHead } from '../middleware/tenderAccess.js'
import { cacheWrap } from '../cache.js'
import {
  lookupKey, tenderKey, invalidateTender,
  tenderMyKey, invalidateTenderMy, invalidateTenderList, invalidateReports,
  versionNotModified, lookupNotModified,
} from '../services/cacheKeys.js'

const LIST_TTL = 10 * 60   // danh sách gói thầu
const INFO_TTL = 10 * 60   // chi tiết/của tôi
const ACT_TTL = 30 * 60    // nhật ký (append-only)

// Gói thầu đổi (tạo/sửa/trạng thái/xóa) → danh sách + của-tôi + báo cáo đấu thầu + nhật ký gói.
function invalidateTenderMeta(id) {
  invalidateTenderList()
  invalidateTenderMy()
  invalidateReports('tender')
  if (id != null) invalidateTender(id, 'info', 'activity')
}

// ──────────────────────────────────────────────────────────────────────────────
// Gói thầu (16 trường) + phân công + trạng thái workflow. Module Ban Đấu thầu (dept 9).
// Danh tính luôn lấy từ req.user (không tin client). Mọi thao tác ghi audit log.
// ──────────────────────────────────────────────────────────────────────────────

const RESULTS = new Set(['Trúng', 'Trượt', 'Hủy'])
const BID_STATUSES = new Set(['Đang làm thầu', 'Đã nộp thầu'])
const WORKFLOW = new Set([
  'Khởi tạo', 'Đã phân công', 'Lập checklist', 'Đang thực hiện',
  'Chờ review', 'Đạt', 'Chưa đạt', 'Sẵn sàng in/ký', 'Có kết quả',
])

// Ghi nhật ký thao tác (fire-and-forget — không chặn luồng nếu lỗi).
export async function logActivity(tenderId, userId, action, detail) {
  try {
    await pool.query(
      'INSERT INTO tender_activity_log (tender_id, user_id, action, detail) VALUES ($1,$2,$3,$4)',
      [tenderId, userId || null, action, detail || null],
    )
    invalidateTender(tenderId, 'activity') // nhật ký mới → làm mới tab nhật ký gói
  } catch (err) {
    console.error('tender logActivity:', err)
  }
}

const SELECT_COLS = `
  t.id, t.package_name, t.package_code, t.customer_id, t.investor,
  t.estimate, t.currency_code, t.exchange_rate, t.submit_date,
  t.field, t.guarantee, t.pakd_no, t.uq_no, t.assign_decision,
  t.bid_maker_id, bm.full_name AS bid_maker_name,
  t.am_id, am.full_name AS am_name,
  t.note, t.result, t.workflow_status, t.bid_status,
  t.created_by, cb.full_name AS created_by_name,
  t.created_at, t.updated_at`

const JOINS = `
  LEFT JOIN app_user bm ON bm.id = t.bid_maker_id
  LEFT JOIN app_user am ON am.id = t.am_id
  LEFT JOIN app_user cb ON cb.id = t.created_by`

export async function getTenders(req, res) {
  try {
    if (await lookupNotModified(req, res, 'tender-list')) return
    const rows = await cacheWrap(lookupKey('tender-list'), LIST_TTL, async () => {
      const { rows } = await pool.query(
        `SELECT ${SELECT_COLS} FROM tender t ${JOINS}
          WHERE t.is_deleted = false
          ORDER BY t.submit_date DESC NULLS LAST, t.id DESC`,
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getTenders:', err)
    res.status(500).json({ error: 'Không thể tải danh sách gói thầu.' })
  }
}

export async function getTender(req, res) {
  const id = parseInt(req.params.id)
  try {
    const row = await cacheWrap(tenderKey(id, 'info'), INFO_TTL, async () => {
      const { rows } = await pool.query(
        `SELECT ${SELECT_COLS} FROM tender t ${JOINS} WHERE t.id = $1 AND t.is_deleted = false`,
        [id],
      )
      return rows[0] ?? null
    })
    if (!row) return res.status(404).json({ error: 'Không tìm thấy gói thầu.' })
    res.json(row)
  } catch (err) {
    console.error('getTender:', err)
    res.status(500).json({ error: 'Không thể tải thông tin gói thầu.' })
  }
}

// Chuẩn hoá payload 16 trường → giá trị insert/update (trim chuỗi, null hoá rỗng).
function readBody(b) {
  const str = (v) => { const s = String(v ?? '').trim(); return s || null }
  const num = (v) => { const n = Number(v); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? n : null }
  const result = str(b.result)
  // Tiền tệ: chỉ chấp nhận mã đã biết; ngoại tệ cần tỷ giá > 0, VND luôn = 1.
  const currency = ['VND', 'USD', 'EUR', 'JPY'].includes(str(b.currency_code)) ? str(b.currency_code) : 'VND'
  const rate = currency === 'VND' ? 1 : (num(b.exchange_rate) > 0 ? num(b.exchange_rate) : null)
  return {
    package_name: str(b.package_name),
    package_code: str(b.package_code),
    customer_id: num(b.customer_id),
    investor: str(b.investor),
    estimate: num(b.estimate),
    currency_code: currency,
    exchange_rate: rate,
    submit_date: str(b.submit_date),       // 'YYYY-MM-DD' từ client
    field: str(b.field),
    guarantee: str(b.guarantee),
    pakd_no: str(b.pakd_no),
    uq_no: str(b.uq_no),
    assign_decision: str(b.assign_decision),
    note: str(b.note),
    result: result && RESULTS.has(result) ? result : null,
    bid_status: BID_STATUSES.has(str(b.bid_status)) ? str(b.bid_status) : 'Đang làm thầu',
  }
}

// Chủ đầu tư lấy từ bảng customer: nếu có customer_id hợp lệ thì chụp lại tên vào
// cột investor (snapshot để hiển thị/xuất). customer_id không tồn tại → bỏ liên kết.
async function resolveInvestor(v) {
  if (!v.customer_id) { v.customer_id = null; return }
  const { rows } = await pool.query('SELECT name FROM customer WHERE id = $1', [v.customer_id])
  if (!rows.length) { v.customer_id = null; return }
  v.investor = rows[0].name
}

export async function createTender(req, res) {
  const v = readBody(req.body)
  if (!v.package_name) return res.status(400).json({ error: 'Tên gói thầu không được để trống.' })
  if (v.currency_code !== 'VND' && !(v.exchange_rate > 0))
    return res.status(400).json({ error: `Nhập tỷ giá VNĐ/${v.currency_code} cho gói thầu ngoại tệ.` })
  try {
    await resolveInvestor(v)
    // Phân công ngay khi tạo: chỉ Trưởng phòng/admin được giao người làm thầu/AM.
    const head = await userIsHead(req.user.id, req.user.role)
    const bidMaker = head && req.body?.bid_maker_id ? parseInt(req.body.bid_maker_id) : null
    const am = head && req.body?.am_id ? parseInt(req.body.am_id) : null
    const status = bidMaker ? 'Đã phân công' : 'Khởi tạo'
    const { rows } = await pool.query(
      `INSERT INTO tender
         (package_name, package_code, customer_id, investor, estimate, currency_code, exchange_rate,
          submit_date, field, guarantee, pakd_no, uq_no, assign_decision, note, result,
          bid_maker_id, am_id, workflow_status, bid_status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING id`,
      [v.package_name, v.package_code, v.customer_id, v.investor, v.estimate, v.currency_code,
        v.exchange_rate, v.submit_date, v.field, v.guarantee, v.pakd_no, v.uq_no, v.assign_decision,
        v.note, v.result, bidMaker, am, status, v.bid_status, req.user.id],
    )
    const id = rows[0].id
    logActivity(id, req.user.id, 'create',
      `Tạo gói thầu "${v.package_name}"${bidMaker ? ` (giao người làm thầu ${bidMaker})` : ''}`)
    // Báo người làm thầu được giao (khác chính mình).
    if (bidMaker && bidMaker !== req.user.id) {
      notifyAction([bidMaker], `Bạn được phân công làm gói thầu: "${v.package_name}"`)
    }
    invalidateTenderMeta(id)
    res.status(201).json({ success: true, id })
  } catch (err) {
    console.error('createTender:', err)
    res.status(500).json({ error: 'Không thể tạo gói thầu.' })
  }
}

export async function updateTender(req, res) {
  const id = parseInt(req.params.id)
  const v = readBody(req.body)
  if (!v.package_name) return res.status(400).json({ error: 'Tên gói thầu không được để trống.' })
  if (v.currency_code !== 'VND' && !(v.exchange_rate > 0))
    return res.status(400).json({ error: `Nhập tỷ giá VNĐ/${v.currency_code} cho gói thầu ngoại tệ.` })
  try {
    await resolveInvestor(v)
    const vals = [v.package_name, v.package_code, v.customer_id, v.investor, v.estimate,
      v.currency_code, v.exchange_rate, v.submit_date, v.field, v.guarantee, v.pakd_no,
      v.uq_no, v.assign_decision, v.note, v.result, v.bid_status]
    let sets = `package_name=$1, package_code=$2, customer_id=$3, investor=$4, estimate=$5,
      currency_code=$6, exchange_rate=$7, submit_date=$8, field=$9, guarantee=$10,
      pakd_no=$11, uq_no=$12, assign_decision=$13, note=$14, result=$15, bid_status=$16`

    // Trưởng phòng/admin có thể đổi phân công ngay tại form sửa. Người làm thầu (không
    // phải head) sửa gói mình phụ trách thì giữ nguyên người làm thầu/AM hiện tại.
    const head = await userIsHead(req.user.id, req.user.role)
    let bidMaker = null, prevBidMaker = null
    if (head) {
      const { rows: cur } = await pool.query(
        'SELECT bid_maker_id, workflow_status FROM tender WHERE id=$1 AND is_deleted=false', [id])
      if (!cur.length) return res.status(404).json({ error: 'Không tìm thấy gói thầu.' })
      bidMaker = req.body?.bid_maker_id ? parseInt(req.body.bid_maker_id) : null
      const am = req.body?.am_id ? parseInt(req.body.am_id) : null
      prevBidMaker = cur[0].bid_maker_id
      const newStatus = bidMaker && cur[0].workflow_status === 'Khởi tạo'
        ? 'Đã phân công' : cur[0].workflow_status
      vals.push(bidMaker, am, newStatus)
      sets += ', bid_maker_id=$17, am_id=$18, workflow_status=$19'
    }
    vals.push(id)
    const { rows } = await pool.query(
      `UPDATE tender SET ${sets}, updated_at=now()
       WHERE id=$${vals.length} AND is_deleted=false RETURNING id`,
      vals,
    )
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy gói thầu.' })
    // Gói CÓ lô → dự toán gói luôn = tổng dự toán các lô (ghi đè giá trị nhập tay ở form).
    await pool.query(
      `UPDATE tender t SET estimate = s.total, updated_at = now()
         FROM (SELECT COUNT(*)::int AS cnt, SUM(estimate) AS total FROM tender_lot WHERE tender_id = $1) s
        WHERE t.id = $1 AND s.cnt > 0`,
      [id],
    )
    logActivity(id, req.user.id, 'update', `Cập nhật thông tin gói thầu`)
    // Báo người làm thầu mới được giao (khác trước đó & khác chính mình).
    if (head && bidMaker && bidMaker !== prevBidMaker && bidMaker !== req.user.id) {
      notifyAction([bidMaker], `Bạn được phân công làm gói thầu: "${v.package_name}"`)
    }
    invalidateTenderMeta(id)
    res.json({ success: true, id })
  } catch (err) {
    console.error('updateTender:', err)
    res.status(500).json({ error: 'Không thể cập nhật gói thầu.' })
  }
}

// Đổi trạng thái workflow / kết quả (người làm thầu hoặc trưởng phòng).
export async function updateTenderStatus(req, res) {
  const id = parseInt(req.params.id)
  const status = String(req.body?.workflow_status ?? '').trim()
  const result = req.body?.result === undefined ? undefined : (String(req.body.result).trim() || null)
  if (status && !WORKFLOW.has(status)) return res.status(400).json({ error: 'Trạng thái không hợp lệ.' })
  if (result && !RESULTS.has(result)) return res.status(400).json({ error: 'Kết quả không hợp lệ.' })
  try {
    const sets = []
    const vals = []
    if (status) { vals.push(status); sets.push(`workflow_status=$${vals.length}`) }
    if (result !== undefined) { vals.push(result); sets.push(`result=$${vals.length}`) }
    if (!sets.length) return res.status(400).json({ error: 'Không có dữ liệu cập nhật.' })
    vals.push(id)
    const { rows } = await pool.query(
      `UPDATE tender SET ${sets.join(', ')}, updated_at=now() WHERE id=$${vals.length} AND is_deleted=false RETURNING id`,
      vals,
    )
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy gói thầu.' })
    logActivity(id, req.user.id, 'status', `Trạng thái: ${status || '—'}${result ? ` / Kết quả: ${result}` : ''}`)
    invalidateTenderMeta(id)
    res.json({ success: true, id })
  } catch (err) {
    console.error('updateTenderStatus:', err)
    res.status(500).json({ error: 'Không thể cập nhật trạng thái.' })
  }
}

export async function deleteTender(req, res) {
  const id = parseInt(req.params.id)
  try {
    const { rows } = await pool.query(
      'UPDATE tender SET is_deleted=true, updated_at=now() WHERE id=$1 AND is_deleted=false RETURNING id',
      [id],
    )
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy gói thầu.' })
    logActivity(id, req.user.id, 'delete', 'Xoá gói thầu')
    invalidateTenderMeta(id)
    res.json({ success: true })
  } catch (err) {
    console.error('deleteTender:', err)
    res.status(500).json({ error: 'Không thể xoá gói thầu.' })
  }
}

export async function getActivityLog(req, res) {
  const id = parseInt(req.params.id)
  try {
    const rows = await cacheWrap(tenderKey(id, 'activity'), ACT_TTL, async () => {
      const { rows } = await pool.query(
        `SELECT l.id, l.action, l.detail, l.created_at, l.user_id, u.full_name AS user_name
           FROM tender_activity_log l
           LEFT JOIN app_user u ON u.id = l.user_id
          WHERE l.tender_id = $1
          ORDER BY l.created_at DESC, l.id DESC`,
        [id],
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getActivityLog:', err)
    res.status(500).json({ error: 'Không thể tải nhật ký.' })
  }
}

// Thành viên ban (cho UI biết ai là HEAD + đổ danh sách người làm thầu).
export async function getMembers(req, res) {
  try {
    if (await lookupNotModified(req, res, 'tender-members')) return
    const rows = await cacheWrap(lookupKey('tender-members'), 6 * 60 * 60, async () => {
      const { rows } = await pool.query(
        `SELECT m.id, m.user_id, u.full_name, m.dept_role, m.is_active
           FROM tender_member m
           JOIN app_user u ON u.id = m.user_id
          WHERE m.department_id = 9 AND m.is_active
          ORDER BY CASE m.dept_role WHEN 'HEAD' THEN 0 ELSE 1 END, u.full_name`,
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('tender getMembers:', err)
    res.status(500).json({ error: 'Không thể tải thành viên.' })
  }
}

// "Việc của tôi" cho người làm thầu: các gói mình phụ trách.
export async function getMyTenders(req, res) {
  try {
    if (await versionNotModified(req, res, 'tender-my', 't-my')) return
    const key = await tenderMyKey(req.user.id)
    const rows = await cacheWrap(key, INFO_TTL, async () => {
      const { rows } = await pool.query(
        `SELECT ${SELECT_COLS} FROM tender t ${JOINS}
          WHERE t.is_deleted=false AND t.bid_maker_id = $1
          ORDER BY t.submit_date DESC NULLS LAST, t.id DESC`,
        [req.user.id],
      )
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getMyTenders:', err)
    res.status(500).json({ error: 'Không thể tải gói thầu của bạn.' })
  }
}
