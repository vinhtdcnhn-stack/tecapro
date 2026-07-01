import { pool } from '../db.js'

// Nhật ký thay đổi (change_log) — API đọc cho trang admin. Mọi route đã gate requireAdmin
// ở auditRoutes.js. Trả dữ liệu thô (table_name/changed_keys/before/after); FE tự ánh xạ
// nhãn tiếng Việt + định dạng giá trị (auditLabels.js).

const MAX_PAGE_SIZE = 100

// Whitelist tên bảng được phép tra cứu (khớp danh sách gắn trigger ở migration 089).
// Chặn giá trị tùy ý lọt vào cột table_name khi tra lịch sử 1 dòng.
const AUDITED_TABLES = new Set([
  'contract_out', 'contract_out_member', 'contract_out_boq', 'contract_out_progress',
  'contract_receivable', 'contract_receivable_payment', 'contract_task',
  'contract_task_attachment', 'contract_guarantee', 'contract_equipment', 'equipment_serial',
  'contract_out_delivery', 'contract_out_invoice', 'contract_out_invoice_item',
  'warranty_case', 'warranty_case_equipment', 'warranty_activity',
  'document', 'document_file', 'document_folder',
  'contract_in', 'contract_in_boq', 'contract_in_payable', 'contract_in_payment',
  'contract_in_delivery', 'contract_in_delivery_item', 'contract_in_delivery_serial',
  'contract_in_guarantee', 'contract_in_customs', 'contract_in_logistics',
  'contract_in_logistics_update', 'contract_in_progress', 'contract_in_supplier_warranty',
  'contract_in_warranty_claim',
])

// Cột chọn dùng chung cho danh sách: kèm tên người thao tác + số HĐ để hiển thị.
const SELECT_COLS = `
  l.id, l.table_name, l.row_id, l.contract_out_id, l.op, l.actor_id,
  l.changed_keys, l.before, l.after, l.at,
  u.full_name AS actor_name, u.email AS actor_email,
  c.contract_no`

const FROM_JOINS = `
  FROM public.change_log l
  LEFT JOIN public.app_user u ON u.id = l.actor_id
  LEFT JOIN public.contract_out c ON c.id = l.contract_out_id`

// GET /api/audit/changes — danh sách có lọc + phân trang.
// Query: contractId, tableName, actorId, op (I|U|D), from, to (ISO date), q, page, pageSize.
export async function listChanges(req, res) {
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || 50))
  const offset = (page - 1) * pageSize

  const where = []
  const params = []
  const add = (sql, val) => { params.push(val); where.push(sql.replace('$$', `$${params.length}`)) }

  if (req.query.contractId) add('l.contract_out_id = $$', Number(req.query.contractId))
  if (req.query.tableName)  add('l.table_name = $$', String(req.query.tableName))
  if (req.query.actorId)    add('l.actor_id = $$', Number(req.query.actorId))
  if (req.query.op)         add('l.op = $$', String(req.query.op).toUpperCase().slice(0, 1))
  if (req.query.from)       add('l.at >= $$', req.query.from)
  if (req.query.to)         add('l.at < ($$::date + 1)', req.query.to) // bao trọn ngày 'to'
  if (req.query.q) {
    const like = `%${String(req.query.q).trim()}%`
    params.push(like)
    where.push(`(c.contract_no ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`)
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

  try {
    const { rows: cnt } = await pool.query(`SELECT count(*)::int AS total ${FROM_JOINS} ${whereSql}`, params)
    const { rows } = await pool.query(
      `SELECT ${SELECT_COLS} ${FROM_JOINS} ${whereSql}
        ORDER BY l.at DESC, l.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset],
    )
    res.json({ items: rows, total: cnt[0].total, page, pageSize })
  } catch (err) {
    console.error('listChanges:', err)
    res.status(500).json({ error: 'Không tải được nhật ký thay đổi.' })
  }
}

// GET /api/audit/contract/:contractId — dòng thời gian của riêng một hợp đồng.
export async function contractTimeline(req, res) {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200))
  try {
    const { rows } = await pool.query(
      `SELECT ${SELECT_COLS} ${FROM_JOINS}
        WHERE l.contract_out_id = $1
        ORDER BY l.at DESC, l.id DESC
        LIMIT $2`,
      [Number(req.params.contractId), limit],
    )
    res.json({ items: rows })
  } catch (err) {
    console.error('contractTimeline:', err)
    res.status(500).json({ error: 'Không tải được lịch sử thay đổi của hợp đồng.' })
  }
}

// GET /api/audit/row/:tableName/:rowId — lịch sử "hình thành & phát triển" của MỘT dòng.
// Trả các mục theo thứ tự thời gian TĂNG DẦN (tạo trước, sửa/xóa sau) để xem tiến trình.
export async function rowTimeline(req, res) {
  const tableName = String(req.params.tableName || '')
  const rowId = Number(req.params.rowId)
  if (!AUDITED_TABLES.has(tableName)) {
    return res.status(400).json({ error: 'Bảng không hợp lệ.' })
  }
  if (!Number.isFinite(rowId)) {
    return res.status(400).json({ error: 'Mã dòng không hợp lệ.' })
  }
  try {
    const { rows } = await pool.query(
      `SELECT ${SELECT_COLS} ${FROM_JOINS}
        WHERE l.table_name = $1 AND l.row_id = $2
        ORDER BY l.at ASC, l.id ASC`,
      [tableName, rowId],
    )
    res.json({ items: rows })
  } catch (err) {
    console.error('rowTimeline:', err)
    res.status(500).json({ error: 'Không tải được lịch sử của dòng dữ liệu.' })
  }
}

// GET /api/audit/options — danh mục cho bộ lọc: các bảng đã có log + người thao tác.
export async function getOptions(req, res) {
  try {
    const { rows: tables } = await pool.query(
      'SELECT DISTINCT table_name FROM public.change_log ORDER BY table_name')
    const { rows: actors } = await pool.query(
      `SELECT DISTINCT u.id, u.full_name, u.email
         FROM public.change_log l JOIN public.app_user u ON u.id = l.actor_id
        ORDER BY u.full_name`)
    res.json({ tables: tables.map(t => t.table_name), actors })
  } catch (err) {
    console.error('getOptions:', err)
    res.status(500).json({ error: 'Không tải được danh mục lọc nhật ký.' })
  }
}
