import { pool } from '../db.js'
import { roundMoney } from '../utils/money.js'

// Xuất hóa đơn (HĐ bán) — quản lý theo từng đợt. Số tiền lưu NGUYÊN TỆ của đợt; làm
// tròn theo currency lúc lưu (roundMoney). amount_before/after_vat tính lại ở server
// từ quantity × unit_price × vat_rate để không tin số client gửi.

const norm = (s) => String(s || '').trim().toLowerCase()

// Kiểm tra danh mục + tồn trước khi lưu một đợt. Mọi dòng phải khớp bảng giá
// (theo boq_id hoặc tên), và SL lũy kế không được vượt SL hợp đồng của dòng bảng giá.
// Gán lại boq_id đã khớp vào từng item (để lưu liên kết). Trả về chuỗi lỗi hoặc null.
async function validateItems(client, contractId, items, excludeInvoiceId = null) {
  const list = (Array.isArray(items) ? items : []).filter(
    it => (it.item_name || '').trim() && (parseFloat(it.quantity) || 0) > 0)
  if (!list.length) return null

  const { rows: boqRows } = await client.query(
    'SELECT id, item_name, quantity FROM contract_out_boq WHERE contract_out_id=$1', [contractId])
  const byId = new Map(boqRows.map(b => [String(b.id), b]))
  const byName = new Map(boqRows.map(b => [norm(b.item_name), b]))

  const newQty = new Map()
  const notInCatalog = []
  const unitMismatch = []
  for (const it of list) {
    const b = it.boq_id ? byId.get(String(it.boq_id)) : byName.get(norm(it.item_name))
    if (!b) { notInCatalog.push((it.item_name || '').trim()); continue }
    const bUnit = norm(b.unit)
    if (bUnit && norm(it.unit) !== bUnit) {
      unitMismatch.push(`${(it.item_name || '').trim()} (ĐVT "${(it.unit || '').trim()}" ≠ bảng giá "${b.unit}")`)
      continue
    }
    it.boq_id = b.id   // khớp được → liên kết dòng bảng giá
    newQty.set(String(b.id), (newQty.get(String(b.id)) || 0) + (parseFloat(it.quantity) || 0))
  }
  if (notInCatalog.length)
    return `Mặt hàng không có trong bảng giá hợp đồng: ${[...new Set(notInCatalog)].join(', ')}.`
  if (unitMismatch.length)
    return `Đơn vị tính không khớp bảng giá: ${unitMismatch.join('; ')}.`

  const params = [contractId]
  let exClause = ''
  if (excludeInvoiceId) { params.push(excludeInvoiceId); exClause = ' AND i.id <> $2' }
  const { rows: invRows } = await client.query(
    `SELECT it.boq_id, SUM(it.quantity) AS qty
       FROM contract_out_invoice_item it
       JOIN contract_out_invoice i ON i.id = it.invoice_id
      WHERE i.contract_out_id = $1 AND it.boq_id IS NOT NULL${exClause}
      GROUP BY it.boq_id`, params)
  const invoiced = new Map(invRows.map(r => [String(r.boq_id), parseFloat(r.qty) || 0]))

  const overflow = []
  for (const [boqId, qty] of newQty) {
    const b = byId.get(boqId)
    const remain = (parseFloat(b.quantity) || 0) - (invoiced.get(boqId) || 0)
    if (qty > remain + 1e-6)
      overflow.push(`${b.item_name} (xuất ${qty}, tồn chưa xuất ${Math.max(0, remain)})`)
  }
  if (overflow.length)
    return `Số lượng vượt tồn chưa xuất hóa đơn theo bảng giá: ${overflow.join('; ')}.`
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
    const { rows } = await pool.query(`
      SELECT i.id, i.contract_out_id, i.invoice_no, i.invoice_date, i.currency_code, i.exchange_rate, i.note,
             COALESCE((SELECT SUM(amount_after_vat) FROM contract_out_invoice_item WHERE invoice_id = i.id), 0) AS total_after_vat,
             COALESCE((SELECT json_agg(json_build_object(
                 'id', it.id, 'boq_id', it.boq_id, 'item_name', it.item_name, 'unit', it.unit,
                 'quantity', it.quantity, 'unit_price', it.unit_price,
                 'amount_before_vat', it.amount_before_vat, 'vat_rate', it.vat_rate,
                 'amount_after_vat', it.amount_after_vat) ORDER BY it.sort_order, it.id)
               FROM contract_out_invoice_item it WHERE it.invoice_id = i.id), '[]') AS items
        FROM contract_out_invoice i
       WHERE i.contract_out_id = $1
       ORDER BY i.invoice_date NULLS LAST, i.id`,
      [req.params.id])
    res.json(rows)
  } catch (err) {
    console.error('getInvoices:', err)
    res.status(500).json({ error: 'Không thể tải danh sách xuất hóa đơn.' })
  }
}

// GET /contracts/:id/invoice-summary → mỗi dòng bảng giá: SL hợp đồng, đã xuất, tồn.
export async function getInvoiceSummary(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT b.id AS boq_id, b.item_name, b.unit, b.quantity AS qty_contract, b.unit_price,
             COALESCE((SELECT SUM(it.quantity) FROM contract_out_invoice_item it
                        JOIN contract_out_invoice i ON i.id = it.invoice_id
                       WHERE it.boq_id = b.id AND i.contract_out_id = $1), 0) AS qty_invoiced
        FROM contract_out_boq b
       WHERE b.contract_out_id = $1
       ORDER BY b.sort_order, b.id`,
      [req.params.id])
    res.json(rows.map(r => ({
      ...r,
      qty_remaining: Math.max(0, (parseFloat(r.qty_contract) || 0) - (parseFloat(r.qty_invoiced) || 0)),
    })))
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
    const vErr = await validateItems(client, contractId, items)
    if (vErr) { await client.query('ROLLBACK'); return res.status(400).json({ error: vErr }) }
    const { rows } = await client.query(
      `INSERT INTO contract_out_invoice (contract_out_id, invoice_no, invoice_date, currency_code, exchange_rate, note)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [contractId, (invoice_no || '').trim(), invoice_date || null, currency,
       parseFloat(exchange_rate) || 1, (note || '').trim()])
    await insertItems(client, rows[0].id, items, currency)
    await client.query('COMMIT')
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
    const { rows } = await pool.query('DELETE FROM contract_out_invoice WHERE id=$1 RETURNING id', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy đợt.' })
    res.json({ success: true })
  } catch (err) {
    console.error('deleteInvoice:', err)
    res.status(500).json({ error: 'Không thể xóa đợt xuất hóa đơn.' })
  }
}
