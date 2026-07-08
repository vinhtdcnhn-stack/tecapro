import { pool } from '../db.js'
import { roundMoney } from '../utils/money.js'
import { verifyUserPassword } from '../auth/verifyPassword.js'
import { computeInvoiceUnits } from './boqTreeUtils.js'
import { cacheWrap } from '../cache.js'
import { contractKey, contractTabNotModified, invalidateContract, invalidateReports } from '../services/cacheKeys.js'

const TAB_TTL = 30 * 60 // 30'

// Hóa đơn đổi → tab invoices + invoice-summary (tồn) + báo cáo công nợ (giá trị đã xuất HĐ).
function invalidateInvoice(contractId) {
  invalidateContract(contractId, 'invoices', 'invoice-summary')
  invalidateReports('debt')
}

// Các cột bảng giá cần để suy ra đơn vị xuất hóa đơn (lá rời + hệ thống nhân SL).
const BOQ_UNIT_COLS = `id, parent_id, row_kind, multiply_qty, item_name, unit, quantity,
                       unit_price, vat_rate, amount_before_vat, amount_after_vat`

// Xuất hóa đơn (HĐ bán) — quản lý theo từng đợt. Số tiền lưu NGUYÊN TỆ của đợt; làm
// tròn theo currency lúc lưu (roundMoney). amount_before/after_vat tính lại ở server
// từ quantity × unit_price × vat_rate để không tin số client gửi.

const norm = (s) => String(s || '').trim().toLowerCase()

// Một đợt được coi là ĐÃ XUẤT hóa đơn thực sự khi có đủ ngày xuất VÀ số HĐ. Đợt nháp
// (thiếu 1 trong 2) không tính vào SL/giá trị đã xuất, không trừ vào tồn chưa xuất.
// Alias bảng phải là `i`. Dùng chung cho tồn (getInvoiceSummary) và guard tồn (validateItems).
const ISSUED_INVOICE_SQL = `i.invoice_date IS NOT NULL AND btrim(coalesce(i.invoice_no, '')) <> ''`

// Kiểm tra danh mục + tồn trước khi lưu một đợt. Mọi dòng phải khớp bảng giá
// (theo boq_id hoặc tên), và SL lũy kế không được vượt SL hợp đồng của dòng bảng giá.
// LƯU Ý: guard tồn ở đây tính CẢ đợt nháp lẫn đợt đã xuất (mọi đợt khác đợt đang lưu) —
// vì cho phép tạo sẵn nhiều đợt nháp, mà đợt nháp chưa bị trừ trên bảng tồn hiển thị,
// nên phải chặn ở đây để tổng các đợt không vượt SL hợp đồng (tránh xuất thừa).
// Gán lại boq_id đã khớp vào từng item (để lưu liên kết). Trả về chuỗi lỗi hoặc null.
async function validateItems(client, contractId, items, excludeInvoiceId = null) {
  const list = (Array.isArray(items) ? items : []).filter(
    it => (it.item_name || '').trim() && (parseFloat(it.quantity) || 0) > 0)
  if (!list.length) return null

  // Đơn vị xuất hóa đơn = dòng lá rời + hệ thống (nhóm bật multiply_qty). Con của hệ
  // thống KHÔNG xuất riêng (cả hệ thống là 1 đơn vị).
  const { rows: allRows } = await client.query(
    `SELECT ${BOQ_UNIT_COLS} FROM contract_out_boq WHERE contract_out_id = $1`, [contractId])
  const units = computeInvoiceUnits(allRows)
  const byId = new Map(units.map(b => [String(b.boq_id), b]))

  // byName chỉ dùng cho tên DUY NHẤT. Tên trùng (bảng giá phân cấp, cùng thiết bị ở
  // nhiều phân khu) KHÔNG khớp theo tên → buộc chọn đúng đơn vị (boq_id).
  const nameCount = new Map()
  for (const b of units) nameCount.set(norm(b.item_name), (nameCount.get(norm(b.item_name)) || 0) + 1)
  const byName = new Map(units.filter(b => nameCount.get(norm(b.item_name)) === 1).map(b => [norm(b.item_name), b]))

  const newQty = new Map()
  const notInCatalog = []
  const unitMismatch = []
  const ambiguous = []
  for (const it of list) {
    let b = it.boq_id ? byId.get(String(it.boq_id)) : byName.get(norm(it.item_name))
    if (!b && !it.boq_id && nameCount.get(norm(it.item_name)) > 1) {
      ambiguous.push((it.item_name || '').trim()); continue
    }
    if (!b) { notInCatalog.push((it.item_name || '').trim()); continue }
    const bUnit = norm(b.unit)
    if (bUnit && norm(it.unit) !== bUnit) {
      unitMismatch.push(`${(it.item_name || '').trim()} (ĐVT "${(it.unit || '').trim()}" ≠ bảng giá "${b.unit}")`)
      continue
    }
    it.boq_id = b.boq_id   // khớp được → liên kết dòng bảng giá / hệ thống
    newQty.set(String(b.boq_id), (newQty.get(String(b.boq_id)) || 0) + (parseFloat(it.quantity) || 0))
  }
  if (notInCatalog.length)
    return `Mặt hàng không có trong bảng giá hợp đồng: ${[...new Set(notInCatalog)].join(', ')}.`
  if (ambiguous.length)
    return `Tên trùng nhau trong bảng giá (có ở nhiều phân khu), hãy chọn đúng dòng cụ thể: ${[...new Set(ambiguous)].join(', ')}.`
  if (unitMismatch.length)
    return `Đơn vị tính không khớp bảng giá: ${unitMismatch.join('; ')}.`

  const params = [contractId]
  let exClause = ''
  if (excludeInvoiceId) { params.push(excludeInvoiceId); exClause = ' AND i.id <> $2' }
  // Tính SL đã cam kết ở MỌI đợt khác (nháp + đã xuất), trừ đợt đang lưu — không lọc
  // theo ISSUED để đợt nháp cũng chiếm chỗ, tránh 2 đợt cùng đưa một mặt hàng vượt HĐ.
  const { rows: invRows } = await client.query(
    `SELECT it.boq_id, SUM(it.quantity) AS qty
       FROM contract_out_invoice_item it
       JOIN contract_out_invoice i ON i.id = it.invoice_id
      WHERE i.contract_out_id = $1 AND it.boq_id IS NOT NULL${exClause}
      GROUP BY it.boq_id`, params)
  const committed = new Map(invRows.map(r => [String(r.boq_id), parseFloat(r.qty) || 0]))

  const overflow = []
  for (const [boqId, qty] of newQty) {
    const b = byId.get(boqId)
    const remain = (parseFloat(b.qty_contract) || 0) - (committed.get(boqId) || 0)
    if (qty > remain + 1e-6)
      overflow.push(`${b.item_name} (xuất ${qty}, còn có thể xuất ${Math.max(0, remain)})`)
  }
  if (overflow.length)
    return `Số lượng vượt SL còn lại theo hợp đồng (đã tính cả các đợt nháp khác): ${overflow.join('; ')}.`
  return null
}

// Chuẩn hóa + tính lại tiền cho 1 dòng item theo currency của đợt.
function normItem(it, currency, idx) {
  const qty   = parseFloat(it.quantity) || 0
  const price = roundMoney(it.unit_price, currency)
  const before = roundMoney(qty * price, currency)
  const vat    = parseFloat(it.vat_rate) || 0
  const after  = roundMoney(before * (1 + vat / 100), currency)
  return {
    boq_id: it.boq_id ? parseInt(it.boq_id, 10) : null,
    item_name: (it.item_name || '').trim(),
    unit: (it.unit || '').trim(),
    quantity: qty, unit_price: price,
    amount_before_vat: before, vat_rate: vat, amount_after_vat: after,
    sort_order: idx + 1,
  }
}

async function insertItems(client, invoiceId, items, currency) {
  const list = Array.isArray(items) ? items : []
  for (let i = 0; i < list.length; i++) {
    const it = normItem(list[i], currency, i)
    await client.query(
      `INSERT INTO contract_out_invoice_item
        (invoice_id, boq_id, item_name, unit, quantity, unit_price, amount_before_vat, vat_rate, amount_after_vat, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [invoiceId, it.boq_id, it.item_name, it.unit, it.quantity, it.unit_price,
       it.amount_before_vat, it.vat_rate, it.amount_after_vat, it.sort_order],
    )
  }
}

// GET /contracts/:id/invoices → danh sách đợt + items + tổng (sau VAT, nguyên tệ).
export async function getInvoices(req, res) {
  try {
    if (await contractTabNotModified(req, res, req.params.id, 'invoices')) return
    const rows = await cacheWrap(contractKey(req.params.id, 'invoices'), TAB_TTL, async () => {
    const { rows } = await pool.query(`
      SELECT i.id, i.contract_out_id, i.invoice_no, i.invoice_date, i.currency_code, i.exchange_rate, i.note,
             i.locked, i.locked_at, lu.full_name AS locked_by_name,
             COALESCE((SELECT SUM(amount_after_vat) FROM contract_out_invoice_item WHERE invoice_id = i.id), 0) AS total_after_vat,
             COALESCE((SELECT json_agg(json_build_object(
                 'id', it.id, 'boq_id', it.boq_id, 'item_name', it.item_name, 'unit', it.unit,
                 'quantity', it.quantity, 'unit_price', it.unit_price,
                 'amount_before_vat', it.amount_before_vat, 'vat_rate', it.vat_rate,
                 'amount_after_vat', it.amount_after_vat) ORDER BY it.sort_order, it.id)
               FROM contract_out_invoice_item it WHERE it.invoice_id = i.id), '[]') AS items
        FROM contract_out_invoice i
        LEFT JOIN app_user lu ON lu.id = i.locked_by
       WHERE i.contract_out_id = $1
       ORDER BY i.invoice_date NULLS LAST, i.id`,
      [req.params.id])
      return rows
    })
    res.json(rows)
  } catch (err) {
    console.error('getInvoices:', err)
    res.status(500).json({ error: 'Không thể tải danh sách xuất hóa đơn.' })
  }
}

// GET /contracts/:id/invoice-summary → mỗi đơn vị xuất hóa đơn: SL hợp đồng, đã xuất, tồn.
// Đơn vị = dòng lá rời + hệ thống (nhóm bật multiply_qty xuất theo bộ).
export async function getInvoiceSummary(req, res) {
  try {
    if (await contractTabNotModified(req, res, req.params.id, 'invoice-summary')) return
    const payload = await cacheWrap(contractKey(req.params.id, 'invoice-summary'), TAB_TTL, async () => {
      const { rows: allRows } = await pool.query(
        `SELECT ${BOQ_UNIT_COLS}, sort_order FROM contract_out_boq
          WHERE contract_out_id = $1 ORDER BY sort_order, id`, [req.params.id])
      const units = computeInvoiceUnits(allRows)

      const { rows: invRows } = await pool.query(
        `SELECT it.boq_id, SUM(it.quantity) AS q
           FROM contract_out_invoice_item it
           JOIN contract_out_invoice i ON i.id = it.invoice_id
          WHERE i.contract_out_id = $1 AND it.boq_id IS NOT NULL
            AND ${ISSUED_INVOICE_SQL}
          GROUP BY it.boq_id`, [req.params.id])
      const invMap = new Map(invRows.map(r => [String(r.boq_id), parseFloat(r.q) || 0]))

      return units.map(u => {
        const invoiced = invMap.get(String(u.boq_id)) || 0
        return {
          boq_id: u.boq_id, item_name: u.item_name, unit: u.unit, qty_contract: u.qty_contract,
          unit_price: u.unit_price, vat_rate: u.vat_rate, amount_after: u.amount_after,
          is_system: u.is_system, group_path: u.group_path,
          qty_invoiced: invoiced,
          qty_remaining: Math.max(0, (parseFloat(u.qty_contract) || 0) - invoiced),
        }
      })
    })
    res.json(payload)
  } catch (err) {
    console.error('getInvoiceSummary:', err)
    res.status(500).json({ error: 'Không thể tải tồn chưa xuất hóa đơn.' })
  }
}

export async function createInvoice(req, res) {
  const contractId = parseInt(req.params.id, 10)
  const { invoice_no, invoice_date, currency_code, exchange_rate, note, items } = req.body
  const currency = currency_code || 'VND'
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // Cho phép tạo sẵn NHIỀU đợt nháp cùng lúc. Không cần chặn theo "một nháp tại một thời
    // điểm" nữa vì validateItems đã tính SL của mọi đợt khác (nháp + đã xuất) khi kiểm tồn,
    // nên một mặt hàng không thể bị đưa vượt SL hợp đồng dù nằm rải ở nhiều đợt nháp.
    const vErr = await validateItems(client, contractId, items)
    if (vErr) { await client.query('ROLLBACK'); return res.status(400).json({ error: vErr }) }
    const { rows } = await client.query(
      `INSERT INTO contract_out_invoice (contract_out_id, invoice_no, invoice_date, currency_code, exchange_rate, note)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [contractId, (invoice_no || '').trim(), invoice_date || null, currency,
       parseFloat(exchange_rate) || 1, (note || '').trim()])
    await insertItems(client, rows[0].id, items, currency)
    await client.query('COMMIT')
    invalidateInvoice(contractId)
    res.status(201).json({ id: rows[0].id })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('createInvoice:', err)
    res.status(500).json({ error: 'Không thể tạo đợt xuất hóa đơn.' })
  } finally {
    client.release()
  }
}

export async function updateInvoice(req, res) {
  const id = parseInt(req.params.id, 10)
  const { invoice_no, invoice_date, currency_code, exchange_rate, note, items } = req.body
  const currency = currency_code || 'VND'
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `UPDATE contract_out_invoice
          SET invoice_no=$1, invoice_date=$2, currency_code=$3, exchange_rate=$4, note=$5, updated_at=now()
        WHERE id=$6 RETURNING id, contract_out_id`,
      [(invoice_no || '').trim(), invoice_date || null, currency,
       parseFloat(exchange_rate) || 1, (note || '').trim(), id])
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Không tìm thấy đợt.' }) }
    if (items !== undefined) {
      const vErr = await validateItems(client, rows[0].contract_out_id, items, id)
      if (vErr) { await client.query('ROLLBACK'); return res.status(400).json({ error: vErr }) }
      await client.query('DELETE FROM contract_out_invoice_item WHERE invoice_id=$1', [id])
      await insertItems(client, id, items, currency)
    }
    await client.query('COMMIT')
    invalidateInvoice(rows[0].contract_out_id)
    res.json({ id })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('updateInvoice:', err)
    res.status(500).json({ error: 'Không thể cập nhật đợt xuất hóa đơn.' })
  } finally {
    client.release()
  }
}

export async function deleteInvoice(req, res) {
  try {
    const { rows } = await pool.query('DELETE FROM contract_out_invoice WHERE id=$1 RETURNING id, contract_out_id', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy đợt.' })
    invalidateInvoice(rows[0].contract_out_id)
    res.json({ success: true })
  } catch (err) {
    console.error('deleteInvoice:', err)
    res.status(500).json({ error: 'Không thể xóa đợt xuất hóa đơn.' })
  }
}

// PATCH /invoices/:id/lock — khóa/mở khóa đợt xuất hóa đơn (PM của HĐ + admin, gác bởi
// pmVia). Khi locked=true mọi thao tác sửa/xóa đợt bị chặn (blockIfLocked) cho tới khi mở.
export async function setInvoiceLock(req, res) {
  const { id } = req.params
  const locked = !!req.body.locked
  try {
    // Mở khóa là thao tác nhạy cảm → buộc xác thực lại mật khẩu của người thực hiện.
    if (!locked) {
      const ok = await verifyUserPassword(req.user.id, req.body.password)
      if (!ok) return res.status(401).json({ error: 'Mật khẩu không đúng.' })
    }
    const { rows } = await pool.query(`
      WITH upd AS (
        UPDATE contract_out_invoice
          SET locked=$1, locked_by=$2, locked_at=$3, updated_at=now()
        WHERE id=$4 RETURNING *
      )
      SELECT upd.id, upd.contract_out_id, upd.locked, upd.locked_at, lu.full_name AS locked_by_name
      FROM upd LEFT JOIN app_user lu ON lu.id = upd.locked_by
    `, [locked, locked ? req.user.id : null, locked ? new Date() : null, id])
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy đợt.' })
    invalidateContract(rows[0].contract_out_id, 'invoices') // chỉ trạng thái khóa hiển thị
    res.json(rows[0])
  } catch (err) {
    console.error('setInvoiceLock:', err)
    res.status(500).json({ error: 'Không thể đổi trạng thái khóa.' })
  }
}
